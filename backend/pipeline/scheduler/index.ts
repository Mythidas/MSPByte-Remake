import Debug from "@workspace/shared/lib/Debug";
import { natsClient } from "@workspace/pipeline/shared/nats";
import { getRows, updateRow } from "@workspace/shared/lib/db/orm";
import { Tables } from "@workspace/shared/types/database";
import { generateUUID } from "@workspace/shared/lib/utils";
import { SyncEventPayload } from "@workspace/shared/types/pipeline";

export class Scheduler {
  private pollInterval: number = 10000; // 30 seconds
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
      // TODO: Make an atomic SQL function to avoid duplicate fetches
      const { data: jobs, error } = await getRows("scheduled_jobs", {
        filters: [
          ["scheduled_at", "lte", new Date().toISOString()],
          ["status", "eq", "pending"],
          ["attempts", "lt", 3],
        ],
      });

      if (error) {
        Debug.error({
          module: "Scheduler",
          context: "pollJobs",
          message: "Failed to fetch scheduled jobs",
          code: "SCHEDULER_FETCH_FAILED",
        });
        return;
      }

      if (jobs.rows.length === 0) {
        return;
      }

      Debug.log({
        module: "Scheduler",
        context: "pollJobs",
        message: `Polling for Jobs: ${jobs.rows.length} jobs found`,
      });

      // Process each job
      for (const job of jobs.rows) {
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

  private async processJob(job: Tables<"scheduled_jobs">): Promise<void> {
    try {
      Debug.log({
        module: "Scheduler",
        context: "processJob",
        message: `Processing job ${job.id} for action ${job.action}`,
      });

      // TODO: Create updated_at and created_at triggers in SQL
      await updateRow("scheduled_jobs", {
        row: {
          status: "running",
          started_at: new Date().toISOString(),
        },
        id: job.id,
      });

      // Action format: "sync.identities"
      const actionParts = job.action.split(".");
      if (actionParts.length === 2 && actionParts[0] === "sync") {
        const topic = `${job.integration_id}.${job.action}`;
        await natsClient.publish(topic, {
          job,
          eventID: generateUUID(),
          tenantID: job.tenant_id,
          integrationID: job.integration_id,
          dataSourceID: job.data_source_id,

          integrationType: job.integration_id,
          entityType: actionParts[1],
        } as SyncEventPayload);

        Debug.log({
          module: "Scheduler",
          context: "processJob",
          message: `Job ${job.id} published to ${topic}`,
        });
      } else {
        throw new Error(`Invalid action format: ${job.action}`);
      }
    } catch (error) {
      Debug.error({
        module: "Scheduler",
        context: "processJob",
        message: `Failed to process job ${job.id}`,
        code: "SCHEDULER_JOB_FAILED",
      });

      await Scheduler.failJob(job, error as string);
    }
  }

  public static async failJob(job: Tables<"scheduled_jobs">, error: string) {
    const attempts = job.attempts || 0;
    const attemptsMax = job.attempts_max || 3;
    const invalid = attempts >= attemptsMax;

    await updateRow("scheduled_jobs", {
      row: {
        status: invalid ? "invalid" : "failed",
        error,
        attempts: attempts + 1,
        attempts_max: attemptsMax,
        next_retry_at: new Date(Date.now() + 60000).toISOString(),
      },
      id: job.id,
    });
  }

  public static async completeJob(
    job: Tables<"scheduled_jobs">,
    dataSource?: Tables<"data_sources">,
    action?: string
  ) {
    await updateRow("scheduled_jobs", {
      row: {
        status: "completed",
      },
      id: job.id,
    });

    if (dataSource && action) {
      await updateRow("data_sources", {
        row: {
          metadata: {
            ...(dataSource.metadata as any),
            action: new Date().toISOString(),
          },
        },
        id: dataSource.id,
      });
    }
  }
}
