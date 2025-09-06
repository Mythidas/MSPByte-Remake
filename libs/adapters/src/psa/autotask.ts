import Debug from "@workspace/shared/lib/Debug.js";
import { IAdapter } from "src/adapter.js";
import { getRow } from "@workspace/shared/lib/db/orm.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import JobScheduler from "src/scheduler.js";
import { connect, JSONCodec, NatsConnection } from "nats";
import {
  DataSources,
  ScheduledJobs,
} from "@workspace/shared/types/database/schema.js";
import { EventPayload } from "@workspace/shared/types/events/index.js";
import AutoTaskConnector from "@workspace/shared/lib/connectors/AutoTaskConnector.js";
import { AutoTaskConfig } from "@workspace/shared/types/source/autotask/generic.js";

export class AutoTaskAdapter implements IAdapter {
  private nats: NatsConnection | undefined;
  private jc = JSONCodec();

  async start(): Promise<void> {
    this.nats = await connect({ servers: process.env.NATS_URL });
    Debug.log({
      module: "Adapters",
      context: "AutoTaskAdapter",
      message: "Adapter started",
    });
  }

  async stop(): Promise<void> {
    Debug.log({
      module: "Adapters",
      context: "AutoTaskAdapter",
      message: "Adapter stopped",
    });
  }

  async connected(): Promise<boolean> {
    return true;
  }

  async processJob(job: ScheduledJobs) {
    Debug.log({
      module: "Adapters",
      context: "AutoTaskAdapter",
      message: `Processing Job: ${job.id}`,
    });

    const { data, error } = await getRow("data_sources", {
      filters: [["id", "eq", job.data_source_id]],
    });
    if (error) {
      return { error };
    }

    switch (job.action) {
      case "sync.companies": {
        return await this.syncCompanies(job, data);
      }
    }

    return Debug.error({
      module: "AutoTaskAdapter",
      context: "processJob",
      message: `Unknown Job action: ${job.action}`,
      code: "UNKNOWN_ACTION",
    });
  }

  private async syncCompanies(job: ScheduledJobs, dataSource: DataSources) {
    const connector = new AutoTaskConnector(
      dataSource.config as AutoTaskConfig
    );
    const health = await connector.checkHealth();
    if (!health) {
      return Debug.error({
        module: "AutoTaskAdapter",
        context: "syncCompanies",
        message: `Connector failed health check: ${dataSource.id}`,
        code: "CONNECTOR_FAILURE",
      });
    }

    const sites = await connector.getCompanies();
    if (sites.error) {
      JobScheduler.failJob(job, sites.error.message);
      return { error: sites.error };
    }

    await this.publishDataEvent("autotask.companies.fetched", {
      job_id: job.id,
      tenant_id: dataSource.tenant_id,
      integration_id: dataSource.integration_id,
      dataType: "companies",
      data: sites.data.map((data) => {
        return {
          external_id: String(data.id),
          data_hash: Encryption.sha256(
            JSON.stringify({
              ...data,
              lastActivityDate: undefined,
              lastTrackedModifiedDateTime: undefined,
            })
          ),
          raw_data: data,
        };
      }),
      total: sites.data.length,
      created_at: new Date().toISOString(),
    } as EventPayload<"*.companies.fetched">);

    JobScheduler.completeJob(job);
    return { data: undefined };
  }

  private async publishDataEvent(subject: string, data: any) {
    this.nats?.publish(subject, this.jc.encode(data));
  }
}
