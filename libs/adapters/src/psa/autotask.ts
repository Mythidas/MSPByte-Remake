import Debug from "@workspace/shared/lib/Debug.js";
import APIClient from "@workspace/shared/lib/APIClient";
import { APIResponse } from "@workspace/shared/types/api.js";
import { IAdapter } from "src/adapter.js";
import { AutoTaskCompany } from "src/types/autotask/company.js";
import {
  AutoTaskConfig,
  AutoTaskResponse,
  AutoTaskSearch,
} from "src/types/autotask/generic.js";
import { Tables } from "@workspace/shared/types/database/index.js";
import { getRow } from "@workspace/shared/lib/db/orm.js";

type ScheduledJobs = Tables<"scheduled_jobs">;
type DataSources = Tables<"data_sources">;

export class AutoTaskAdapter implements IAdapter {
  async start(): Promise<void> {
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
      case "sync.sites": {
        return await this.syncSites(job, data);
      }
    }

    return Debug.error({
      module: "AutoTaskAdapter",
      context: "processJob",
      message: `Unknown Job action: ${job.action}`,
      code: "UNKNOWN_ACTION",
    });
  }

  private async syncSites(job: ScheduledJobs, dataSource: DataSources) {
    const sites = await this.getExtCompanies(dataSource);
    if (sites.error) {
      // Log this to the job DB and up retry count
      return { error: sites.error };
    }

    console.log(sites.data.length);
    // Emit event with site data so services can process

    return { data: undefined };
  }

  // AutoTask Actions
  private async getExtCompanies(
    dataSource: DataSources
  ): Promise<APIResponse<AutoTaskCompany[]>> {
    const config = dataSource.config as AutoTaskConfig;
    const search: AutoTaskSearch<AutoTaskCompany> = {
      filter: [],
    };

    const { data, error } = await APIClient.fetch<
      AutoTaskResponse<AutoTaskCompany>
    >(
      `https://${config.server}/ATServicesRest/V1.0/Companies/query?search=${JSON.stringify(search)}`,
      {
        method: "GET",
        headers: {
          UserName: config.client_id,
          Secret: config.client_secret,
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
