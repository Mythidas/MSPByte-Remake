import { DataEventTemplate } from "@workspace/shared/types/events/template.js";

export type EndpointEvents = {
  "*.endpoints.fetched": DataEventTemplate<"endpoints">;
};
