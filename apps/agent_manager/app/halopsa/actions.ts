"use server";

import { ConvexHttpClient } from "convex/browser";
import HaloPSAConnector from "@workspace/shared/lib/connectors/HaloPSAConnector";
import { api } from "@/lib/api";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel";
import crypto from "crypto";
import { randomUUID } from "crypto";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function calculateDataHash(data: any): string {
	return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

/**
 * Toggle hide status for a HaloPSA company entity
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

export async function syncHaloPSASites() {
	try {
		// 1. Get HaloPSA data source
		const dataSource = (await convex.query(api.helpers.orm.get_s, {
			tableName: "data_sources",
			secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
			index: {
				name: "by_integration",
				params: { integrationId: "halopsa" },
			},
			filters: { isPrimary: true },
		})) as Doc<"data_sources"> | null;

		if (!dataSource) {
			throw new Error("HaloPSA data source not found");
		}

		// 2. Fetch sites from HaloPSA
		const connector = new HaloPSAConnector(
			dataSource.config,
			process.env.NEXT_ENCRYPTION_KEY!
		);
		const { data: sites, error } = await connector.getSites();

		if (error || !sites) {
			throw new Error(error?.message || "Failed to fetch sites");
		}

		for (const site of sites) {
			if (site.id === 389) {
				console.log(site);
			}
		}

		// 3. Get existing entities
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

		// 4. Calculate changes
		const syncId = randomUUID();
		const toCreate = [];
		const toUpdate = [];
		const seenIds = new Set();

		for (const site of sites) {
			const externalId = site.id.toString();
			seenIds.add(externalId);
			const dataHash = calculateDataHash(site);
			const existingEntity = existing.find(
				(e: any) => e.externalId === externalId
			);

			if (!existingEntity) {
				toCreate.push({
					integrationId: "halopsa",
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

		// 5. Execute mutations
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
