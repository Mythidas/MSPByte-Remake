import Debug from "@workspace/shared/lib/Debug.js";
import { natsClient } from "@workspace/pipeline/helpers/nats.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc } from "@workspace/database/convex/_generated/dataModel.js";
import { generateUUID } from "@workspace/shared/lib/utils.server.js";
import { SyncEventPayload } from "@workspace/shared/types/pipeline/index.js";
import { client } from "@workspace/shared/lib/convex.js";

export class Scheduler {
  private pollInterval: number = 60000; // 60 seconds (reduced from 10s to save function calls)
  private isRunning: boolean = false;

  constructor() {}

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    Debug.log({
      module: "Scheduler",
      context: "start",
      message: "Scheduler started",
    });

    // Poll for jobs every interval
    setInterval(async () => {
      await this.pollJobs();
    }, this.pollInterval);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    Debug.log({
      module: "Scheduler",
      context: "stop",
      message: "Scheduler stopped",
    });
  }

  private async pollJobs(): Promise<void> {
    try {
      // Query for due jobs that haven't exceeded retry count
      const jobs = await client.query(api.scheduledjobs.crud.list_s, {
        secret: process.env.CONVEX_API_KEY!,
        filter: {
          by_status: { status: "pending" },
        },
      });

      if (!jobs || jobs.length === 0) {
        return;
      }

      // Filter for due jobs under retry limit
      const dueJobs = jobs.filter((job) => {
        const isDue = job.scheduledAt <= Date.now();
        const underRetryLimit = (job.attempts || 0) < (job.attemptsMax || 3);
        return isDue && underRetryLimit;
      });

      if (dueJobs.length === 0) {
        return;
      }

      Debug.log({
        module: "Scheduler",
        context: "pollJobs",
        message: `Polling for Jobs: ${dueJobs.length} jobs found`,
      });

      // Process each job
      for (const job of dueJobs) {
        await this.processJob(job);
      }
    } catch (error) {
      Debug.error({
        module: "Scheduler",
        context: "pollJobs",
        message: `Error polling jobs: ${error}`,
        code: "SCHEDULER_POLL_ERROR",
      });
    }
  }

  private async processJob(job: Doc<"scheduled_jobs">): Promise<void> {
    try {
      Debug.log({
        module: "Scheduler",
        context: "processJob",
        message: `Processing job ${job._id} for action ${job.action}`,
      });

      await client.mutation(api.scheduledjobs.crud.update_s, {
        id: job._id,
        updates: {
          status: "running",
          startedAt: Date.now(),
        },
        secret: process.env.CONVEX_API_KEY!,
      });

      // Action format: "sync.identities"
      const actionParts = job.action.split(".");
      if (actionParts.length === 2 && actionParts[0] === "sync") {
        const topic = `${job.integrationSlug}.${job.action}`;
        await natsClient.publish(topic, {
          job,
          eventID: await generateUUID(),
          tenantID: job.tenantId,
          integrationID: job.integrationId,
          dataSourceID: job.dataSourceId,

          integrationType: job.integrationSlug as any,
          entityType: actionParts[1],
          stage: "sync",
          createdAt: new Date().getTime(),
        } as SyncEventPayload);

        Debug.log({
          module: "Scheduler",
          context: "processJob",
          message: `Job ${job._id} published to ${topic}`,
        });
      } else {
        throw new Error(`Invalid action format: ${job.action}`);
      }
    } catch (error) {
      Debug.error({
        module: "Scheduler",
        context: "processJob",
        message: `Failed to process job ${job._id}`,
        code: "SCHEDULER_JOB_FAILED",
      });

      await Scheduler.failJob(job, error as string);
    }
  }

  public static async failJob(job: Doc<"scheduled_jobs">, error: string) {
    const attempts = job.attempts || 0;
    const attemptsMax = job.attemptsMax || 3;
    const invalid = attempts >= attemptsMax;

    await client.mutation(api.scheduledjobs.crud.update_s, {
      id: job._id,
      updates: {
        status: invalid ? "failed" : "failed",
        error,
        attempts: attempts + 1,
        nextRetryAt: Date.now() + 60000,
      },
      secret: process.env.CONVEX_API_KEY!,
    });
  }

  public static async completeJob(
    job: Doc<"scheduled_jobs">,
    dataSource?: Doc<"data_sources">,
    action?: string
  ) {
    await client.mutation(api.scheduledjobs.crud.update_s, {
      id: job._id,
      updates: {
        status: "completed",
      },
      secret: process.env.CONVEX_API_KEY!,
    });

    if (dataSource && action) {
      await client.mutation(api.datasources.crud.update_s, {
        id: dataSource._id,
        updates: {
          metadata: {
            ...(dataSource.metadata as any),
            [action]: Date.now(),
          },
        },
        secret: process.env.CONVEX_API_KEY!,
      });
    }
  }
}
