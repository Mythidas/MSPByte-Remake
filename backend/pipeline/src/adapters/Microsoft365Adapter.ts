import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/database/convex/_generated/api.js";
import { BaseAdapter } from "./BaseAdapter.js";
import { SyncJobData } from "../lib/queue.js";
import { AdapterFetchResult } from "../types.js";
import { Logger } from "../lib/logger.js";
import Microsoft365Connector from "@workspace/shared/lib/connectors/Microsoft365Connector.js";
import type { Microsoft365DataSourceConfig } from "@workspace/shared/types/integrations/microsoft-365/index.js";

/**
 * Microsoft365Adapter - Fetches data from Microsoft Graph API using Microsoft365Connector
 *
 * Supported entity types:
 * - identities: Users from /users endpoint (with pagination)
 * - groups: Groups from /groups endpoint
 * - licenses: Subscribed SKUs from /subscribedSkus endpoint (with friendly names)
 * - roles: Directory roles from /directoryRoles endpoint
 * - policies: Conditional access policies + security defaults
 */
export class Microsoft365Adapter extends BaseAdapter {
  private convex: ConvexHttpClient;
  private secret: string;
  private licenseCatalog: Map<string, string> = new Map();
  private catalogLoaded = false;

  constructor(convexUrl: string) {
    super("microsoft-365");

    this.convex = new ConvexHttpClient(convexUrl);

    // Validate CONVEX_API_KEY is set
    this.secret = process.env.CONVEX_API_KEY || "";
    if (!this.secret) {
      throw new Error(
        "CONVEX_API_KEY environment variable is required for Microsoft365Adapter",
      );
    }
  }

  protected getAdapterName(): string {
    return "Microsoft365Adapter";
  }

  /**
   * Fetch data from Microsoft Graph API using connector
   */
  protected async fetchData(jobData: SyncJobData): Promise<AdapterFetchResult> {
    const { dataSourceId, entityType, cursor } = jobData;

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

    const config = dataSource.config as Microsoft365DataSourceConfig;

    // Create connector
    const connector = new Microsoft365Connector(config);

    // Health check
    const healthy = await connector.checkHealth();
    if (!healthy) {
      throw new Error(
        `Connector health check failed for data source ${dataSourceId}`,
      );
    }

    // Route to entity-specific handler
    switch (entityType) {
      case "identities":
        return await this.handleIdentitySync(connector, config, cursor);
      case "groups":
        return await this.handleGroupSync(connector);
      case "licenses":
        return await this.handleLicenseSync(connector);
      case "roles":
        return await this.handleRoleSync(connector);
      case "policies":
        return await this.handlePolicySync(connector);
      default:
        throw new Error(
          `Unsupported entity type for Microsoft 365: ${entityType}`,
        );
    }
  }

  /**
   * Handle identity (user) sync with pagination and domain mapping
   */
  private async handleIdentitySync(
    connector: Microsoft365Connector,
    config: Microsoft365DataSourceConfig,
    cursor?: string,
  ): Promise<AdapterFetchResult> {
    // Check domain mappings
    if (!config?.domainMappings?.length) {
      throw new Error("Data source has no mapped domains or sites");
    }

    // Fetch from connector with cursor support
    const { data, error } = await connector.getIdentities({
      domains: config.domainMappings.map((d) => d.domain),
      cursor,
    });

    if (error) {
      throw new Error(error.message || "Failed to fetch identities");
    }

    const { identities, next } = data;

    // Map to RawEntity with site association
    const entities = identities.map((rawData: any) => {
      const siteId = config.domainMappings.find((map) =>
        rawData.userPrincipalName?.endsWith(map.domain),
      )?.siteId;

      return {
        externalId: rawData.id,
        siteId,
        rawData,
      };
    });

    Logger.log({
      module: "Microsoft365Adapter",
      context: "handleIdentitySync",
      message: `Fetched ${entities.length} identities, hasMore: ${!!next}`,
      level: "trace",
    });

    return {
      entities,
      pagination: {
        hasMore: !!next,
        cursor: next,
      },
    };
  }

  /**
   * Handle group sync with members and memberOf data
   */
  private async handleGroupSync(
    connector: Microsoft365Connector,
  ): Promise<AdapterFetchResult> {
    const { data: groups, error } = await connector.getGroups();

    if (error) {
      throw new Error(error.message || "Failed to fetch groups");
    }

    // Enrich each group with members and memberOf data
    const entities = await Promise.all(
      groups.map(async (rawData: any) => {
        // Fetch group members
        const { data: members } = await connector.getGroupMembers(rawData.id);
        const memberIds = members ? members.map((m) => m.id) : [];

        // Fetch parent groups (memberOf)
        const { data: parentGroups } = await connector.getGroupMemberOf(
          rawData.id,
        );
        const parentGroupIds = parentGroups
          ? parentGroups
              .filter((p) => p["@odata.type"] === "#microsoft.graph.group")
              .map((p) => p.id)
          : [];

        return {
          externalId: rawData.id,
          rawData: {
            ...rawData,
            members: memberIds,
            memberOf: parentGroupIds,
          },
        };
      }),
    );

    Logger.log({
      module: "Microsoft365Adapter",
      context: "handleGroupSync",
      message: `Fetched ${entities.length} groups with members and memberOf data`,
      level: "trace",
    });

    return {
      entities,
      pagination: {
        hasMore: false,
      },
    };
  }

  /**
   * Handle license sync with friendly names from Microsoft CSV
   */
  private async handleLicenseSync(
    connector: Microsoft365Connector,
  ): Promise<AdapterFetchResult> {
    // Load catalog on first sync
    await this.loadLicenseCatalog();

    const { data: skus, error } = await connector.getSubscribedSkus();

    if (error) {
      throw new Error(error.message || "Failed to fetch licenses");
    }

    const entities = skus.map((rawData: any) => {
      // Try to get friendly name from catalog
      const friendlyName =
        this.licenseCatalog.get(rawData.skuId) || rawData.skuPartNumber;

      return {
        externalId: rawData.skuId,
        rawData: {
          ...rawData,
          friendlyName, // Add friendly name to raw data
        },
      };
    });

    Logger.log({
      module: "Microsoft365Adapter",
      context: "handleLicenseSync",
      message: `Fetched ${entities.length} licenses`,
      level: "trace",
    });

    return {
      entities,
      pagination: {
        hasMore: false,
      },
    };
  }

  /**
   * Handle role sync with members data
   */
  private async handleRoleSync(
    connector: Microsoft365Connector,
  ): Promise<AdapterFetchResult> {
    const { data: roles, error } = await connector.getRoles();

    if (error) {
      throw new Error(error.message || "Failed to fetch roles");
    }

    // Enrich each role with members data
    const entities = await Promise.all(
      roles.map(async (rawData: any) => {
        // Fetch role members
        const { data: members } = await connector.getRoleMembers(rawData.id);
        const memberIds = members ? members.map((m) => m.id) : [];

        return {
          externalId: rawData.id,
          rawData: {
            ...rawData,
            members: memberIds,
          },
        };
      }),
    );

    Logger.log({
      module: "Microsoft365Adapter",
      context: "handleRoleSync",
      message: `Fetched ${entities.length} roles with members data`,
      level: "trace",
    });

    return {
      entities,
      pagination: {
        hasMore: false,
      },
    };
  }

  /**
   * Handle policy sync (conditional access + security defaults)
   */
  private async handlePolicySync(
    connector: Microsoft365Connector,
  ): Promise<AdapterFetchResult> {
    const { data: policies, error: policiesError } =
      await connector.getConditionalAccessPolicies();

    if (policiesError) {
      throw new Error(policiesError.message || "Failed to fetch policies");
    }

    const { data: securityDefaults } =
      await connector.getSecurityDefaultsEnabled();

    // Add security defaults as a pseudo-policy
    const sdPolicy = securityDefaults
      ? {
          externalId: "security-defaults",
          rawData: {
            id: "security-defaults",
            displayName: "Security Defaults",
            state: "enabled",
            createdDateTime: "",
          },
        }
      : undefined;

    const entities = [
      ...policies.map((rawData: any) => ({
        externalId: rawData.id,
        rawData,
      })),
    ];
    if (sdPolicy) entities.push(sdPolicy);

    Logger.log({
      module: "Microsoft365Adapter",
      context: "handlePolicySync",
      message: `Fetched ${entities.length} policies (including security defaults)`,
      level: "trace",
    });

    return {
      entities,
      pagination: {
        hasMore: false,
      },
    };
  }

  /**
   * Load license catalog from Microsoft's official CSV mapping file
   * Only loads once per adapter instance
   */
  private async loadLicenseCatalog(): Promise<void> {
    if (this.catalogLoaded) return;

    const csvUrl =
      "https://download.microsoft.com/download/e/3/e/e3e9faf2-f28b-490a-9ada-c6089a1fc5b0/Product%20names%20and%20service%20plan%20identifiers%20for%20licensing.csv";

    try {
      Logger.log({
        module: "Microsoft365Adapter",
        context: "loadLicenseCatalog",
        message: "Loading license catalog from Microsoft CSV...",
        level: "info",
      });

      const response = await fetch(csvUrl);
      const csvText = await response.text();
      const lines = csvText.split("\n");

      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const fields = this.parseCSVLine(lines[i]);
        if (fields.length >= 3) {
          const productDisplayName = fields[0];
          const guid = fields[2];

          if (guid) {
            this.licenseCatalog.set(guid, productDisplayName);
          }
        }
      }

      this.catalogLoaded = true;

      Logger.log({
        module: "Microsoft365Adapter",
        context: "loadLicenseCatalog",
        message: `Loaded ${this.licenseCatalog.size / 2} license SKUs from Microsoft CSV`,
        level: "info",
      });
    } catch (err) {
      Logger.log({
        module: "Microsoft365Adapter",
        context: "loadLicenseCatalog",
        message: `Error loading license catalog: ${err}. Will use SKU IDs as fallback.`,
        level: "warn",
      });
      // Don't set catalogLoaded to true so it can retry on next sync
    }
  }

  /**
   * Parse a CSV line handling quoted fields with commas
   */
  private parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let currentField = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === "," && !insideQuotes) {
        fields.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }

    // Add the last field
    if (currentField) {
      fields.push(currentField.trim());
    }

    return fields;
  }
}
