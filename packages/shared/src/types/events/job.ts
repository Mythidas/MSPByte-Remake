import { Tables } from "@workspace/shared/types/database";
import { DataEventEntityTypes } from "@workspace/shared/types/events/data-event";

export type JobEvents = {
  "*.sync.*": {
    event_id: string;
    type: DataEventEntityTypes;
    job: Tables<"scheduled_jobs">;
  };
};
