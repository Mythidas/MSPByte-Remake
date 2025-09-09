import Debug from "@workspace/shared/lib/Debug.js";
import { IAdapter } from "src/adapter.js";
import { getRow } from "@workspace/shared/lib/db/orm.js";
import { connect, JSONCodec, NatsConnection } from "nats";
import { Tables } from "@workspace/shared/types/database/import.js";
import SophosPartnerConnector from "@workspace/shared/lib/connectors/SophosPartnerConnector.js";
import {
  SophosPartnerConfig,
  SophosTenantConfig,
} from "@workspace/shared/types/source/sophos-partner/index.js";
import JobScheduler from "src/scheduler.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import { EventPayload } from "@workspace/shared/types/events/index.js";

export class SophosPartnerAdapter implements IAdapter {
  private nats: NatsConnection | undefined;
  private jc = JSONCodec();

  async start(): Promise<void> {
    this.nats = await connect({ servers: process.env.NATS_URL });
    Debug.log({
      module: "Adapters",
      context: "SophosPartnerAdapter",
      message: "Adapter started",
    });
  }

  async stop(): Promise<void> {
    Debug.log({
      module: "Adapters",
      context: "SophosPartnerAdapter",
      message: "Adapter stopped",
    });
  }

  async connected(): Promise<boolean> {
    return true;
  }

  async processJob(job: Tables<"scheduled_jobs">) {
    Debug.log({
      module: "Adapters",
      context: "SophosPartnerAdapter",
      message: `Processing Job: ${job.id}`,
    });

    const { data, error } = await getRow("data_sources", {
      filters: [["id", "eq", job.data_source_id]],
    });
    if (error) {
      return { error };
    }

    switch (job.action) {
      case "sync.endpoints": {
        return await this.syncEndpoints(job, data);
      }
    }

    return Debug.error({
      module: "SophosPartnerAdapter",
      context: "processJob",
      message: `Unknown Job action: ${job.action}`,
      code: "UNKNOWN_ACTION",
    });
  }

  private async syncEndpoints(
    job: Tables<"scheduled_jobs">,
    dataSource: Tables<"data_sources">
  ) {
    const { data: tenantDataSource } = await getRow("data_sources", {
      filters: [
        ["integration_id", "eq", dataSource.integration_id],
        ["site_id", "is", null],
      ],
    });
    if (!tenantDataSource) {
      return Debug.error({
        module: "SophosPartnerAdapter",
        context: "syncEndpoints",
        message: `No Tenant Data Source found for SophosPartner`,
        code: "DATA_FAILURE",
      });
    }

    const connector = new SophosPartnerConnector(
      tenantDataSource.config as SophosPartnerConfig
    );
    const health = await connector.checkHealth();
    if (!health) {
      return Debug.error({
        module: "SophosPartnerAdapter",
        context: "syncEndpoints",
        message: `Connector failed health check: ${dataSource.id}`,
        code: "CONNECTOR_FAILURE",
      });
    }

    const endpoints = await connector.getEndpoints(
      dataSource.external_id || "",
      dataSource.config as SophosTenantConfig
    );

    if (endpoints.error) {
      JobScheduler.failJob(job, endpoints.error.message);
      return { error: endpoints.error };
    }

    await this.publishDataEvent("sophos-partner.endpoints.fetched", {
      job_id: job.id,
      tenant_id: dataSource.tenant_id,
      integration_id: dataSource.integration_id,
      site_id: dataSource.site_id,
      dataType: "endpoints",
      data: endpoints.data.map((data) => {
        return {
          external_id: String(data.id),
          data_hash: Encryption.sha256(
            JSON.stringify({
              ...data,
              lastSeenAt: undefined,
            })
          ),
          raw_data: data,
        };
      }),
      total: endpoints.data.length,
      created_at: new Date().toISOString(),
    } as EventPayload<"*.endpoints.fetched">);

    JobScheduler.completeJob(job, dataSource);
    return { data: undefined };
  }

  private async publishDataEvent(subject: string, data: any) {
    this.nats?.publish(subject, this.jc.encode(data));
  }
}
