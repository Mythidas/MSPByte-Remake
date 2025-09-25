import {
  DataFetchedEvent,
  DataProcessedEvent,
} from "@workspace/shared/types/events/data-event";

export type GeneralEvents = {
  "*.fetched": DataFetchedEvent;
  "*.processed": DataProcessedEvent;
};
