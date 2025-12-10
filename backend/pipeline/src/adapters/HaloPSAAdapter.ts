import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/database/convex/_generated/api.js";
import { BaseAdapter } from "./BaseAdapter.js";
import { SyncJobData } from "../lib/queue.js";
import { AdapterFetchResult } from "../types.js";
import { Logger } from "../lib/logger.js";
import { HaloPSAConfig } from "@workspace/shared/types/integrations/halopsa/index.js";
import HaloPSAConnector from "@workspace/shared/lib/connectors/HaloPSAConnector.js";

/**
 * HaloPSAAdapter
 *
 * Supported entity types:
 * - companies
 */
export class HaloPSAAdapter extends BaseAdapter {
  private convex: ConvexHttpClient;
  private secret: string;

  constructor(convexUrl: string) {
    super("halopsa");

    this.convex = new ConvexHttpClient(convexUrl);

    // Validate CONVEX_API_KEY is set
    this.secret = process.env.CONVEX_API_KEY || "";
    if (!this.secret) {
      throw new Error(
        "CONVEX_API_KEY environment variable is required for HaloPSAAdapter",
      );
    }
  }

  protected getAdapterName(): string {
    return "HaloPSAAdapter";
  }

  /**
   * Fetch data from Microsoft Graph API using connector
   */
  protected async fetchData(jobData: SyncJobData): Promise<AdapterFetchResult> {
    const { dataSourceId, entityType } = jobData;

    // Get data source config
    this.metrics.trackQuery();
    const dataSource = (await this.convex.query(api.helpers.orm.get_s, {
      tableName: "data_sources",
      id: dataSourceId,
      secret: this.secret,
    })) as any;

    if (!dataSource) {
      throw new Error(`Data source not found: ${dataSourceId}`);
    }

    const config = dataSource.config as HaloPSAConfig;

    // Create connector
    const connector = new HaloPSAConnector(config, process.env.ENCRYPTION_KEY!);

    // Health check
    const healthy = await connector.checkHealth();
    if (!healthy) {
      throw new Error(
        `Connector health check failed for data source ${dataSourceId}`,
      );
    }

    // Route to entity-specific handler
    switch (entityType) {
      case "companies":
        return await this.handleCompanySync(connector);
      default:
        throw new Error(
          `Unsupported entity type for HaloPSA: ${entityType}`,
        );
    }
  }

  /**
   * Handle group sync with members and memberOf data
   */
  private async handleCompanySync(
    connector: HaloPSAConnector,
  ): Promise<AdapterFetchResult> {
    const { data: sites, error } = await connector.getSites();

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }

    // Enrich each group with members and memberOf data
    const entities = sites.map((s) => ({
        externalId: s.id.toString(),
        rawData: s
    }));

    Logger.log({
      module: "HaloPSAAdapter",
      context: "handleCompanySync",
      message: `Fetched ${entities.length} companies`,
      level: "trace",
    });

    return {
      entities,
      pagination: {
        hasMore: false,
      },
    };
  }
}
