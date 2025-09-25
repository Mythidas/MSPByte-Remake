import { natsClient } from "@workspace/pipeline/shared/nats";
import { getRow } from "@workspace/shared/lib/db/orm";
import { EventPayload } from "@workspace/shared/types/events";
import Debug from "@workspace/shared/lib/Debug";
import { DataFetchPayload } from "@workspace/shared/types/events/data-event";
import { APIResponse } from "@workspace/shared/types/api";
import { Scheduler } from "@workspace/pipeline/scheduler";

export abstract class BaseAdapter {
  constructor(
    protected integrationType: string,
    protected actionMap?: Record<string, string>
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

  private async handleJob(eventData: EventPayload<"*.sync.*">): Promise<void> {
    const { type, job } = eventData;
    const rawData: DataFetchPayload[] = [];

    if (job.data_source_id) {
      const { data: dataSource, error } = await getRow("data_sources", {
        filters: [["id", "eq", job.data_source_id]],
      });
      if (!dataSource) {
        Debug.error({
          module: "BaseAdapter",
          context: "start",
          message: `Failed to find data_source: ${error.message}`,
          code: "DB_FAILURE",
        });
        return;
      }

      const result = await this.getRawData(
        eventData,
        job.tenant_id,
        dataSource.id,
        dataSource.config
      );
      if (result.error) {
        Scheduler.failJob(eventData.job, result.error.message);
        return;
      } else {
        Scheduler.completeJob(
          eventData.job,
          dataSource,
          `sync.${eventData.type}`
        );
        rawData.push(...result.data);
      }
    } else {
      const result = await this.getRawData(eventData, job.tenant_id);
      if (result.error) {
        Scheduler.failJob(eventData.job, result.error.message);
        return;
      } else {
        Scheduler.completeJob(eventData.job);
        rawData.push(...result.data);
      }
    }

    const subject = `${type}.fetched`;

    try {
      await natsClient.publish(subject, {
        eventID: eventData.event_id,
        tenantID: job.tenant_id,
        integrationID: job.integration_id,
        dataSourceID: job.data_source_id,
        entityType: type,

        data: rawData,

        total: 0,
        createdAt: new Date().toISOString(),
      } as EventPayload<"*.fetched">);

      Debug.log({
        module: "BaseAdapter",
        context: "handleJob",
        message: `Published *.fetched event with ${rawData.length} entities`,
      });
    } catch (err) {
      Debug.error({
        module: "BaseAdapter",
        context: "handleJob",
        message: `Failed to publish *.fetched: ${err}`,
        code: "NATS_FAILURE",
      });
    }
  }

  protected abstract getRawData(
    eventData: EventPayload<"*.sync.*">,
    tenantID: string,
    dataSourceID?: string,
    config?: any
  ): Promise<APIResponse<DataFetchPayload[]>>;
}
