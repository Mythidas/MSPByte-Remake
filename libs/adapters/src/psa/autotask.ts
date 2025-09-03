import Debug from "@workspace/shared/lib/Debug.js";
import APIClient from "@workspace/shared/lib/APIClient";
import { APIResponse } from "@workspace/shared/types/api.js";
import { IAdapter } from "src/adapter.js";
import {
  Tables,
  TablesInsert,
} from "@workspace/shared/types/database/index.js";
import { getRow } from "@workspace/shared/lib/db/orm.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import JobScheduler from "src/scheduler.js";
import { AutoTaskCompany } from "@workspace/shared/types/source/autotask/company.js";
import {
  AutoTaskConfig,
  AutoTaskSearch,
  AutoTaskResponse,
} from "@workspace/shared/types/source/autotask/generic.js";
import { connect, JSONCodec, NatsConnection } from "nats";
import {
  DataSources,
  ScheduledJobs,
} from "@workspace/shared/types/database/schema.js";
import { EventPayload } from "@workspace/shared/types/events/index.js";

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
    const sites = await this.getExtCompanies(dataSource);
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

  // AutoTask Actions
  private async getExtCompanies(
    dataSource: DataSources
  ): Promise<APIResponse<AutoTaskCompany[]>> {
    const config = dataSource.config as AutoTaskConfig;
    const search: AutoTaskSearch<AutoTaskCompany> = {
      filter: [{ field: "isActive", op: "eq", value: true }],
    };

    const secret = (await Encryption.decrypt(config.client_secret)) || "failed";
    const { data, error } = await APIClient.fetch<
      AutoTaskResponse<AutoTaskCompany>
    >(
      `https://${config.server}/ATServicesRest/V1.0/Companies/query?search=${JSON.stringify(search)}`,
      {
        method: "GET",
        headers: {
          UserName: config.client_id,
          Secret: secret,
          ApiIntegrationCode: config.tracker_id,
        },
      },
      "AutoTaskAdapter"
    );

    if (error) {
      return { error };
    }

    return {
      data: data.items,
    };
  }
}
