import { natsClient } from "@workspace/pipeline/shared/nats";
import { insertRows, updateRow } from "@workspace/shared/lib/db/orm";
import Debug from "@workspace/shared/lib/Debug";

export abstract class BaseAdapter {
  protected integrationType: string;

  constructor(integrationType: string) {
    this.integrationType = integrationType;
  }

  async start(): Promise<void> {
    // Subscribe to sync topics for this integration type
    // Format: sync.{entityType}.{integrationType}
    const pattern = `${this.integrationType}.sync.*`;
    await natsClient.subscribe(pattern, this.handleJob.bind(this));
    Debug.log({
      module: "BaseAdapter",
      context: this.integrationType,
      message: `Adapter started, listening to ${pattern}`,
    });
  }

  private async handleJob(jobData: any): Promise<void> {
    const { jobId, integrationId, dataSourceId, tenantId, payload, action } =
      jobData;

    try {
      Debug.log({
        module: "BaseAdapter",
        context: this.integrationType,
        message: `Processing job ${jobId}`,
      });

      // Extract entity type from action (sync.identities.microsoft-365)
      const entityType = action.split(".")[1];

      // Fetch external data
      const rawData = await this.fetchData(payload, dataSourceId, tenantId);

      // Store in database with raw_data
      const entityId = await this.storeRawData(
        rawData,
        tenantId,
        integrationId,
        dataSourceId,
        entityType
      );

      // Publish to processor topic
      await natsClient.publish(`${entityType}.fetched`, {
        entityId,
        integrationId,
        tenantId,
        rawData,
      });

      // Mark job as completed
      await this.updateJobStatus(jobId, "completed");

      Debug.log({
        module: "BaseAdapter",
        context: this.integrationType,
        message: `Completed job ${jobId}`,
      });
    } catch (error) {
      const errorResponse = Debug.error({
        module: "BaseAdapter",
        context: this.integrationType,
        message: `Failed job ${jobId}`,
        code: "ADAPTER_JOB_FAILED",
      });
      await this.updateJobStatus(jobId, "failed", errorResponse.error);
    }
  }

  protected abstract fetchData(
    payload: any,
    dataSourceId: string,
    tenantId: string
  ): Promise<any>;

  private async storeRawData(
    rawData: any,
    tenantId: string,
    integrationId: string,
    dataSourceId: string,
    entityType: string
  ): Promise<string> {
    // Generate a hash of the raw data for deduplication
    const dataHash = await this.generateDataHash(rawData);

    const { data, error } = await insertRows("entities", {
      rows: [
        {
          tenant_id: tenantId,
          integration_id: integrationId,
          data_source_id: dataSourceId,
          entity_type: entityType,
          external_id: rawData.id || rawData.external_id || "",
          raw_data: rawData,
          normalized_data: {},
          data_hash: dataHash,
        },
      ],
    });

    if (error) {
      throw new Error(`Failed to store raw data: ${error.message}`);
    }

    return data[0].id;
  }

  private async updateJobStatus(
    jobId: string,
    status: string,
    error?: any
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "completed") {
      // Job completed successfully - no additional fields needed
    } else if (status === "failed" && error) {
      updateData.error =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error.message
            ? error.message
            : "Unknown error";
      // Don't increment attempts here - scheduler handles that
    }

    await updateRow("scheduled_jobs", {
      row: updateData,
      id: jobId,
    });
  }

  private async generateDataHash(data: any): Promise<string> {
    // Simple hash generation - in production you'd use a proper hashing algorithm
    const jsonString = JSON.stringify(data);
    return btoa(jsonString).substring(0, 32);
  }
}
