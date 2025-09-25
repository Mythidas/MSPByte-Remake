import Debug from "@workspace/shared/lib/Debug";
import { natsClient } from "@workspace/pipeline/shared/nats";
import { getRows, updateRow, insertRows } from "@workspace/shared/lib/db/orm";

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

    // Initial poll
    await this.pollJobs();
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

      Debug.log({
        module: "Scheduler",
        context: "pollJobs",
        message: `Polling for Jobs: ${jobs.rows.length} jobs found`,
      });

      if (jobs.rows.length === 0) {
        return;
      }

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

  private async processJob(job: any): Promise<void> {
    try {
      Debug.log({
        module: "Scheduler",
        context: "processJob",
        message: `Processing job ${job.id} for action ${job.action}`,
      });

      // Update job status to running
      await updateRow("scheduled_jobs", {
        row: {
          status: "running",
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        id: job.id,
      });

      // Parse the action to determine topic and data
      // Action format: "sync.identities.microsoft-365"
      const actionParts = job.action.split(".");
      if (actionParts.length >= 3 && actionParts[0] === "sync") {
        const entityType = actionParts[1];
        const integration = actionParts[2];

        const topic = `sync.${entityType}.${integration}`;
        await natsClient.publish(topic, {
          jobId: job.id,
          integrationId: job.integration_id,
          dataSourceId: job.data_source_id,
          tenantId: job.tenant_id,
          payload: job.payload,
          action: job.action,
        });

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

      // Update job with error and increment retry count
      await updateRow("scheduled_jobs", {
        row: {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          attempts: (job.attempts || 0) + 1,
          next_retry_at: new Date(Date.now() + 60000).toISOString(), // Retry in 1 minute
          updated_at: new Date().toISOString(),
        },
        id: job.id,
      });
    }
  }

  async scheduleJob(
    action: string,
    tenantId: string,
    integrationId: string,
    payload: any,
    scheduledAt: Date,
    dataSourceId?: string
  ): Promise<void> {
    try {
      const { error } = await insertRows("scheduled_jobs", {
        rows: [
          {
            action,
            tenant_id: tenantId,
            integration_id: integrationId,
            data_source_id: dataSourceId || null,
            payload,
            scheduled_at: scheduledAt.toISOString(),
            started_at: new Date().toISOString(),
            status: "pending",
            attempts: 0,
            attempts_max: 3,
            created_by: "system", // This should be the actual user ID
          },
        ],
      });

      if (error) {
        throw error;
      }

      Debug.log({
        module: "Scheduler",
        context: "scheduleJob",
        message: `Scheduled job for ${action} tenant ${tenantId}`,
      });
    } catch (error) {
      Debug.error({
        module: "Scheduler",
        context: "scheduleJob",
        message: `Failed to schedule job for ${action}`,
        code: "SCHEDULER_SCHEDULE_FAILED",
      });
      throw error;
    }
  }
}
