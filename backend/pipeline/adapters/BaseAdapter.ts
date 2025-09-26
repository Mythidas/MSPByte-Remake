import { Scheduler } from "@workspace/pipeline/scheduler";
import { natsClient } from "@workspace/pipeline/shared/nats";
import { getRow } from "@workspace/shared/lib/db/orm";
import Debug from "@workspace/shared/lib/Debug";
import { APIResponse } from "@workspace/shared/types/api";
import { Tables } from "@workspace/shared/types/database";
import {
  IntegrationType,
  EntityType,
  SyncEventPayload,
  FetchedEventPayload,
  FailedEventPayload,
  DataFetchPayload,
  buildEventName,
  flowResolver,
} from "@workspace/shared/types/pipeline";

export type RawDataProps = {
  eventData: SyncEventPayload;
  tenantID: string;
  dataSource?: Tables<"data_sources">;
};

export abstract class BaseAdapter {
  constructor(
    protected integrationType: IntegrationType,
    protected supportedEntities: EntityType[]
  ) {}

  async start(): Promise<void> {
    // Subscribe to sync topics for this integration type
    const pattern = `${this.integrationType}.sync.*`;
    await natsClient.subscribe(pattern, this.handleJob.bind(this));
    Debug.log({
      module: "BaseAdapter",
      context: this.integrationType,
      message: `Adapter started, listening to ${pattern}`,
    });
  }

  private async handleJob(syncEvent: SyncEventPayload): Promise<void> {
    const { entityType, job, tenantID } = syncEvent;

    // Validate this adapter supports the requested entity type
    if (!this.supportedEntities.includes(entityType)) {
      Debug.error({
        module: "BaseAdapter",
        context: "handleJob",
        message: `Adapter ${this.integrationType} does not support entity type ${entityType}`,
        code: "UNSUPPORTED_ENTITY",
      });
      return;
    }
    const rawData: DataFetchPayload[] = [];

    if (syncEvent.dataSourceID) {
      const { data: dataSource, error } = await getRow("data_sources", {
        filters: [["id", "eq", syncEvent.dataSourceID]],
      });
      if (!dataSource) {
        await Scheduler.failJob(job, error.message);
        return;
      }

      const result = await this.getRawData({
        eventData: syncEvent,
        tenantID,
        dataSource,
      });
      if (result.error) {
        await Scheduler.failJob(job, result.error.message);
        return;
      } else {
        rawData.push(...result.data);
        await Scheduler.completeJob(job, dataSource, `sync.${entityType}`);
      }
    } else {
      const result = await this.getRawData({
        eventData: syncEvent,
        tenantID,
      });
      if (result.error) {
        await Scheduler.failJob(job, result.error.message);
        return;
      } else {
        rawData.push(...result.data);
        await Scheduler.completeJob(job);
      }
    }

    // Determine the next stage in the pipeline
    const nextStage = flowResolver.getNextStage(
      "sync",
      entityType,
      this.integrationType
    );
    if (!nextStage) {
      Debug.error({
        module: "BaseAdapter",
        context: "handleJob",
        message: `No next stage found for ${entityType} in ${this.integrationType}`,
        code: "FLOW_RESOLUTION_ERROR",
      });
      return;
    }

    const eventName = buildEventName(nextStage, entityType);
    const fetchedEvent: FetchedEventPayload = {
      eventID: syncEvent.eventID,
      tenantID: syncEvent.tenantID,
      integrationID: syncEvent.integrationID,
      integrationType: this.integrationType,
      dataSourceID: syncEvent.dataSourceID,
      entityType: entityType,
      stage: "fetched",
      createdAt: new Date().toISOString(),
      parentEventID: syncEvent.eventID,

      data: rawData,
      total: rawData.length,
      hasMore: false,
    };

    try {
      await natsClient.publish(eventName, fetchedEvent);

      Debug.log({
        module: "BaseAdapter",
        context: "handleJob",
        message: `Published ${eventName} event with ${rawData.length} entities`,
      });
    } catch (err) {
      Debug.error({
        module: "BaseAdapter",
        context: "handleJob",
        message: `Failed to publish ${eventName}: ${err}`,
        code: "NATS_FAILURE",
      });
    }
  }

  protected abstract getRawData(
    props: RawDataProps
  ): Promise<APIResponse<DataFetchPayload[]>>;

  private async publishFailedEvent(
    originalEvent: SyncEventPayload,
    errorMessage: string,
    errorCode: string
  ): Promise<void> {
    const failedEvent: FailedEventPayload = {
      eventID: originalEvent.eventID,
      tenantID: originalEvent.tenantID,
      integrationID: originalEvent.integrationID,
      integrationType: this.integrationType,
      dataSourceID: originalEvent.dataSourceID,
      entityType: originalEvent.entityType,
      stage: "failed",
      createdAt: new Date().toISOString(),
      parentEventID: originalEvent.eventID,

      error: {
        code: errorCode,
        message: errorMessage,
        retryable: errorCode !== "UNSUPPORTED_ENTITY",
      },
      failedAt: "sync",
    };

    const eventName = buildEventName("failed", originalEvent.entityType);

    try {
      await natsClient.publish(eventName, failedEvent);
    } catch (err) {
      Debug.error({
        module: "BaseAdapter",
        context: "publishFailedEvent",
        message: `Failed to publish failure event: ${err}`,
        code: "NATS_FAILURE",
      });
    }
  }
}
