"use server";

import { ConvexHttpClient } from "convex/browser";
import DattoRMMConnector from "@workspace/shared/lib/connectors/DattoRMMConnector";
import type { DattoRMMConfig } from "@workspace/shared/types/integrations/dattormm";
import type { Id, Doc } from "@workspace/database/convex/_generated/dataModel";
import { api } from "@/lib/api";
import crypto from "crypto";
import { randomUUID } from "crypto";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function calculateDataHash(data: any): string {
	return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

/**
 * Test DattoRMM connection using credentials
 * Uses DattoRMMConnector.checkHealth()
 */
export async function testConnection(config: DattoRMMConfig) {
	try {
		// Create connector with provided config
		const connector = new DattoRMMConnector(
			config,
			process.env.NEXT_ENCRYPTION_KEY!
		);

		// Use checkHealth method
		const { error } = await connector.checkHealth();

		if (error) {
			return {
				success: false,
				error: error.message || "Connection test failed",
			};
		}

		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			error: error.message || "Unknown error",
		};
	}
}

/**
 * Toggle hide status for a DattoRMM site entity
 * Uses tags array to store "cust_hidden" tag
 */
export async function toggleHideStatus(
	entityId: Id<"entities">,
	isHidden: boolean
) {
	try {
		// Get current entity
		const entity = (await convex.query(api.helpers.orm.get_s, {
			tableName: "entities",
			id: entityId,
			secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
		})) as Doc<"entities"> | null;

		if (!entity) {
			return { success: false, error: "Entity not found" };
		}

		// Update tags array - add or remove "cust_hidden"
		const currentTags = entity.tags || [];
		const newTags = isHidden
			? [...currentTags.filter((t) => t !== "cust_hidden"), "cust_hidden"]
			: currentTags.filter((t) => t !== "cust_hidden");

		await convex.mutation(api.helpers.orm.update_s, {
			tableName: "entities",
			secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
			data: [
				{
					id: entityId,
					updates: {
						tags: newTags,
					},
				},
			],
		});

		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			error: error.message || "Failed to toggle hide status",
		};
	}
}

/**
 * Sync Datto RMM sites from API to entities table
 * Pattern based on syncHaloPSASites
 */
export async function syncDattoRMMSites() {
	try {
		// 1. Get Datto RMM data source
		const dataSource = (await convex.query(api.helpers.orm.get_s, {
			tableName: "data_sources",
			secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
			index: {
				name: "by_integration",
				params: { integrationId: "datto-rmm" },
			},
			filters: { isPrimary: true },
		})) as Doc<"data_sources"> | null;

		if (!dataSource) {
			throw new Error("Datto RMM data source not found");
		}

		// 2. Decrypt credentials and create connector
		const config = dataSource.config as DattoRMMConfig;

		const connector = new DattoRMMConnector(
			{
				...config,
			},
			process.env.NEXT_ENCRYPTION_KEY!
		);

		// 3. Fetch sites from Datto RMM
		const { data: sites, error } = await connector.getSites();

		if (error || !sites) {
			throw new Error(error?.message || "Failed to fetch sites");
		}

		// 4. Get existing entities
		const existing = (await convex.query(api.helpers.orm.list_s, {
			tableName: "entities",
			secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
			index: {
				name: "by_data_source_type",
				params: {
					dataSourceId: dataSource._id,
					entityType: "companies",
				},
			},
		})) as Doc<"entities">[];

		// 5. Calculate changes
		const syncId = randomUUID();
		const toCreate = [];
		const toUpdate = [];
		const seenIds = new Set();

		for (const site of sites) {
			const externalId = site.uid;
			seenIds.add(externalId);
			const dataHash = calculateDataHash(site);
			const existingEntity = existing.find(
				(e: any) => e.externalId === externalId
			);

			if (!existingEntity) {
				toCreate.push({
					integrationId: "datto-rmm",
					dataSourceId: dataSource._id,
					entityType: "companies",
					state: "normal",
					externalId,
					dataHash,
					rawData: site,
					lastSeenAt: Date.now(),
					syncId,
					updatedAt: Date.now(),
				});
			} else if (
				existingEntity.dataHash !== dataHash ||
				!existingEntity.syncId
			) {
				toUpdate.push({
					id: existingEntity._id,
					updates: {
						rawData: site,
						dataHash,
						lastSeenAt: Date.now(),
						syncId,
						updatedAt: Date.now(),
					},
				});
			}
		}

		// Mark deleted (entities not seen in this sync)
		const toDelete = existing
			.filter((e: any) => !seenIds.has(e.externalId) && !e.deletedAt)
			.map((e: any) => ({
				id: e._id,
				updates: { deletedAt: Date.now(), updatedAt: Date.now() },
			}));

		// 6. Execute mutations
		if (toCreate.length > 0) {
			if (!dataSource.tenantId) {
				throw new Error("Data source missing tenantId");
			}

			await convex.mutation(api.helpers.orm.insert_s, {
				tableName: "entities",
				tenantId: dataSource.tenantId,
				secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
				data: toCreate,
			});
		}

		if (toUpdate.length > 0 || toDelete.length > 0) {
			await convex.mutation(api.helpers.orm.update_s, {
				tableName: "entities",
				secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
				data: [...toUpdate, ...toDelete],
			});
		}

		return {
			success: true,
			created: toCreate.length,
			updated: toUpdate.length,
			deleted: toDelete.length,
			total: sites.length,
		};
	} catch (error: any) {
		return {
			success: false,
			error: error.message || "Unknown error",
		};
	}
}

/**
 * Push MSPByte site ID to Datto RMM site variable
 * Pattern based on frontend pushSiteVariable
 */
export async function pushSiteVariable(
	dataSourceId: Id<"data_sources">,
	siteId: Id<"sites">,
	rmmSiteId: string
) {
	try {
		// Fetch data source config
		const dataSource = (await convex.query(api.helpers.orm.get_s, {
			tableName: "data_sources",
			id: dataSourceId,
			secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
		})) as any;

		if (!dataSource) {
			return { success: false, error: "Data source not found" };
		}

		const config = dataSource.config as DattoRMMConfig;
		const variableName = config.siteVariableName || "MSPSiteCode";

		// Create connector
		const connector = new DattoRMMConnector(
			{
				...config,
			},
			process.env.NEXT_ENCRYPTION_KEY!
		);

		// Push site variable
		const { error } = await connector.setSiteVariable(
			rmmSiteId,
			variableName,
			siteId
		);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			error: error.message || "Failed to push site variable",
		};
	}
}

/**
 * Check if site variable is set for a single DattoRMM site
 */
export async function checkSiteVariable(
	dataSourceId: Id<"data_sources">,
	rmmSiteId: string,
	siteId: Id<"sites">
) {
	try {
		// Fetch data source config
		const dataSource = (await convex.query(api.helpers.orm.get_s, {
			tableName: "data_sources",
			id: dataSourceId,
			secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
		})) as any;

		if (!dataSource) {
			return { status: "unknown" as const, error: "Data source not found" };
		}

		const config = dataSource.config as DattoRMMConfig;
		const variableName = config.siteVariableName || "MSPSiteCode";

		// Create connector
		const connector = new DattoRMMConnector(
			{
				...config,
			},
			process.env.NEXT_ENCRYPTION_KEY!
		);

		// Get site variable
		const { data, error } = await connector.getSiteVariable(
			rmmSiteId,
			variableName
		);

		if (error) {
			console.error("Error checking site variable:", error);
			return { status: "unknown" as const };
		}

		// Check if value matches siteId (data is the string value directly)
		if (data && data.value === siteId) {
			return { status: "set" as const, value: data };
		} else if (data) {
			return { status: "not_set" as const, value: data };
		} else {
			return { status: "not_set" as const };
		}
	} catch (error: any) {
		console.error("Error checking site variable:", error);
		return { status: "unknown" as const };
	}
}

/**
 * Bulk check site variables for multiple sites
 * Uses Promise.allSettled for parallel API calls
 */
export async function bulkCheckVariables(
	dataSourceId: Id<"data_sources">,
	linkedSites: Array<{ rmmSiteId: string; siteId: Id<"sites"> }>
) {
	try {
		// Fetch data source config once
		const dataSource = (await convex.query(api.helpers.orm.get_s, {
			tableName: "data_sources",
			id: dataSourceId,
			secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
		})) as any;

		if (!dataSource) {
			const emptyResult: Record<string, { status: "unknown"; value?: string }> =
				{};
			linkedSites.forEach((site) => {
				emptyResult[site.rmmSiteId] = { status: "unknown" };
			});
			return emptyResult;
		}

		const config = dataSource.config as DattoRMMConfig;
		const variableName = config.siteVariableName || "MSPSiteCode";

		// Create connector once
		const connector = new DattoRMMConnector(
			{
				...config,
			},
			process.env.NEXT_ENCRYPTION_KEY!
		);

		// Check all sites in parallel
		const results = await Promise.allSettled(
			linkedSites.map(async (site) => {
				const { data, error } = await connector.getSiteVariable(
					site.rmmSiteId,
					variableName
				);

				if (error) {
					return {
						rmmSiteId: site.rmmSiteId,
						status: "unknown" as const,
					};
				}

				// data is the string value directly, not an object with value property
				if (data && data.value === site.siteId) {
					return {
						rmmSiteId: site.rmmSiteId,
						status: "set" as const,
						value: data,
					};
				} else if (data) {
					return {
						rmmSiteId: site.rmmSiteId,
						status: "not_set" as const,
						value: data,
					};
				} else {
					return {
						rmmSiteId: site.rmmSiteId,
						status: "not_set" as const,
					};
				}
			})
		);

		// Collect results
		const statusMap: Record<
			string,
			{ status: "set" | "not_set" | "unknown"; value?: string }
		> = {};

		results.forEach((result, index) => {
			const site = linkedSites[index];
			if (result.status === "fulfilled") {
				statusMap[result.value.rmmSiteId] = {
					status: result.value.status,
					value: result.value.value?.value,
				};
			} else {
				statusMap[site.rmmSiteId] = { status: "unknown" };
			}
		});

		return statusMap;
	} catch (error: any) {
		console.error("Error in bulk check variables:", error);
		const emptyResult: Record<string, { status: "unknown"; value?: string }> =
			{};
		linkedSites.forEach((site) => {
			emptyResult[site.rmmSiteId] = { status: "unknown" };
		});
		return emptyResult;
	}
}
