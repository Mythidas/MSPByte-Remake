import { DataEventTemplate } from "@workspace/shared/types/events/template";

export type EndpointEvents = {
  "*.endpoints.fetched": DataEventTemplate<"endpoints">;
};
