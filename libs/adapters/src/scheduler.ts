import { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@workspace/shared/lib/db/client.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { Tables } from "@workspace/shared/types/database/index.js";
import { Database } from "@workspace/shared/types/database/schema.js";

type ScheduledJobs = Tables<"scheduled_jobs">;

export default class JobScheduler {
  private static supabase: SupabaseClient<Database>;
  private static isRunning = false;

  static async start() {
    this.supabase = createClient() as unknown as SupabaseClient<Database>;
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

  static async completeJob(job: ScheduledJobs) {
    await this.supabase
      .from("scheduled_jobs")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }

  static async failJob(job: ScheduledJobs, error: string) {
    const status =
      job.attempts && job.attempts_max && job.attempts >= job.attempts_max
        ? "invalid"
        : "failed";
    const attempts = job.attempts ? job.attempts + 1 : 1;
    const attemptsMax = job.attempts_max || 3;

    await this.supabase
      .from("scheduled_jobs")
      .update({
        status,
        attempts,
        attempts_max: attemptsMax,
        updated_at: new Date().toISOString(),
        error,
      })
      .eq("id", job.id);
  }

  static async claimJobs(jobs: ScheduledJobs[]) {
    await this.supabase
      .from("scheduled_jobs")
      .update({
        status: "processing",
      })
      .in(
        "id",
        jobs.map((j) => j.id)
      );
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
