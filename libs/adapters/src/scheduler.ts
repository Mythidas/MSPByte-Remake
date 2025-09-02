import { createClient } from "@workspace/shared/lib/db/client.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { Tables } from "@workspace/shared/types/database/index.js";

type ScheduledJobs = Tables<"scheduled_jobs">;

export default class JobScheduler {
  private static supabase = createClient();
  private static isRunning = false;

  static async start() {
    this.isRunning = true;
    this.scheduleLoop();
    Debug.log({
      module: "Adapters",
      context: "JobScheduler",
      message: "Job Scheduler started",
    });
  }

  static async stop() {
    this.isRunning = false;
    Debug.log({
      module: "Adapters",
      context: "JobScheduler",
      message: "Job Scheduler stopped",
    });
  }

  private static async scheduleLoop() {
    while (this.isRunning) {
      try {
        await this.sleep(10000);
      } catch (err) {
        Debug.error({
          module: "JobScheduler",
          context: "scheduleLoop",
          message: `Error in schedule loop: ${err}`,
          code: "ADPT_SCHEDULE_JOBS",
        });
        await this.sleep(5000);
      }
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
