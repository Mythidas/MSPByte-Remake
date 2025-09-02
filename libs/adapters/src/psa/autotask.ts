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

type ScheduledJobs = Tables<"scheduled_jobs">;
type DataSources = Tables<"data_sources">;

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

    const transformed = this.transformCompanies(dataSource, sites.data);
    await this.publishDataEvent("autotask.companies.fetched", {
      tenant_id: dataSource.tenant_id,
      integration_id: dataSource.integration_id,
      dataType: "companies",
      created_at: new Date().toISOString(),
      data: transformed,
      meta: {
        job_id: job.id,
        total: transformed.length,
      },
    });

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

  private transformCompanies(
    dataSource: DataSources,
    companies: AutoTaskCompany[]
  ): TablesInsert<"entities">[] {
    return companies.map((company) => {
      return {
        tenant_id: dataSource.tenant_id,
        external_id: String(company.id),
        entity_type: "company",
        integration_id: dataSource.integration_id,
        raw_data: company,
        normalized_data: {
          external_id: String(company.id),
          name: company.companyName,
          address: company.address1,
          type: company.companyType === 1 ? "customer" : "prospect",

          created_at: company.createDate,
        },
        data_hash: "",
      };
    });
  }
}
