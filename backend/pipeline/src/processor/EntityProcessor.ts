import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/database/convex/_generated/api.js";
import { Job } from "bullmq";
import crypto from "crypto";
import { ProcessJobData, QueueNames, queueManager } from "../lib/queue.js";
import { MetricsCollector } from "../lib/metrics.js";
import { Logger } from "../lib/logger.js";
import type { Id } from "@workspace/database/convex/_generated/dataModel";
import type {
	IntegrationId,
	EntityType,
} from "@workspace/shared/types/integrations";

/**
 * EntityProcessor - Single generic processor for all entity types
 */
export class EntityProcessor {
	private convex: ConvexHttpClient;
	private metrics: MetricsCollector;
	private secret: string;

	constructor(convexUrl: string) {
		this.convex = new ConvexHttpClient(convexUrl);
		this.metrics = new MetricsCollector();

		// Validate CONVEX_API_KEY is set
		this.secret = process.env.CONVEX_API_KEY || "";
		if (!this.secret) {
			throw new Error(
				"CONVEX_API_KEY environment variable is required for EntityProcessor",
			);
		}
	}

	/**
	 * Initialize the processor worker
	 */
	start(): void {
		queueManager.createWorker<ProcessJobData>(
			QueueNames.process,
			this.processJob.bind(this),
			{
				concurrency: 10, // Process up to 10 batches in parallel
			},
		);

		Logger.log({
			module: "EntityProcessor",
			context: "start",
			message: "EntityProcessor worker started",
			level: "info",
		});
	}

	/**
	 * Process a job from the queue
	 */
	private async processJob(job: Job<ProcessJobData>): Promise<void> {
		const {
			tenantId,
			integrationId,
			dataSourceId,
			entityType,
			entities,
			siteId,
			syncId,
			startedAt,
			metrics: previousMetrics,
		} = job.data;

		// Restore metrics from adapter stage if present
		if (previousMetrics) {
			const previous = MetricsCollector.fromJSON(previousMetrics);
			this.metrics = previous;
		} else {
			this.metrics.reset();
		}

		this.metrics.startStage("processor");

		Logger.log({
			module: "EntityProcessor",
			context: "processJob",
			message: `Processing ${entities.length} ${entityType} entities for datasource ${dataSourceId}`,
			level: "info",
		});

		try {
			if (!tenantId) {
				throw new Error(`No tenantId: ${syncId}`);
			}

			// Split into chunks of 100 for optimal performance
			const chunks = this.chunkArray(entities, 100);

			Logger.log({
				module: "EntityProcessor",
				context: "processJob",
				message: `Split into ${chunks.length} chunks of up to 100 entities`,
				level: "trace",
			});

			// Process each chunk
			for (let i = 0; i < chunks.length; i++) {
				await this.processChunk(
					chunks[i],
					tenantId,
					integrationId,
					dataSourceId,
					entityType,
					syncId,
				);

				Logger.log({
					module: "EntityProcessor",
					context: "processJob",
					message: `Processed chunk ${i + 1}/${chunks.length}`,
					level: "trace",
				});
			}

			this.metrics.endStage("processor");

			const metrics = this.metrics.getMetrics();
			Logger.log({
				module: "EntityProcessor",
				context: "processJob",
				message: `Completed: ${metrics.entities_created} created, ${metrics.entities_updated} updated, ${metrics.entities_unchanged} unchanged`,
				level: "info",
			});

			// Trigger linking stage after all chunks processed with accumulated metrics
			await this.triggerLinking(
				integrationId,
				tenantId,
				dataSourceId,
				syncId,
				siteId,
				startedAt,
				entityType,
			);
		} catch (error) {
			this.metrics.trackError(error as Error, job.attemptsMade);
			this.metrics.endStage("processor");

			Logger.log({
				module: "EntityProcessor",
				context: "processJob",
				message: `Failed to process entities: ${error}`,
				level: "error",
			});

			throw error; // Re-throw to trigger BullMQ retry
		}
	}

	/**
	 * Process a chunk of entities (batched queries and mutations)
	 */
	private async processChunk(
		entities: Array<{ externalId: string; siteId?: string; rawData: any }>,
		tenantId: Id<"tenants">,
		integrationId: IntegrationId,
		dataSourceId: Id<"data_sources">,
		entityType: EntityType,
		syncId: string,
	): Promise<void> {
		const now = Date.now();

		// STEP 1: Fetch ALL existing entities in ONE query
		const externalIds = entities.map((e) => e.externalId);

		this.metrics.trackQuery();
		const existingEntities = (await this.convex.query(api.helpers.orm.list_s, {
			tableName: "entities",
			tenantId,
			secret: this.secret,
			index: {
				name: "by_data_source_type",
				params: {
					dataSourceId,
					entityType,
				},
			},
			filters: {
				externalId: { in: externalIds }, // Batch query!
			},
		})) as any[];

		Logger.log({
			module: "EntityProcessor",
			context: "processChunk",
			message: `Fetched ${existingEntities.length} existing entities out of ${entities.length}`,
			level: "trace",
		});

		// STEP 2: Build map for O(1) lookup
		const existingMap = new Map(existingEntities.map((e) => [e.externalId, e]));

		// STEP 3: Categorize entities
		const toCreate: any[] = [];
		const toUpdate: any[] = [];
		const toTouch: any[] = [];

		for (const entityData of entities) {
			const existing = existingMap.get(entityData.externalId);
			const dataHash = this.calculateHash(entityData.rawData);

			if (!existing) {
				// CREATE: Entity doesn't exist
				toCreate.push({
					integrationId,
					dataSourceId,
					siteId: entityData.siteId, // Optional site association
					entityType,
					state: "normal",
					externalId: entityData.externalId,
					dataHash,
					rawData: entityData.rawData,
					lastSeenAt: now,
					syncId,
					updatedAt: now,
				});
			} else if (existing.dataHash !== dataHash) {
				// UPDATE: Data changed
				toUpdate.push({
					id: existing._id,
					updates: {
						dataHash,
						rawData: entityData.rawData,
						lastSeenAt: now,
						syncId,
						updatedAt: now,
					},
				});
			} else {
				// TOUCH: Data unchanged, just update lastSeenAt
				toTouch.push({
					id: existing._id,
					updates: {
						lastSeenAt: now,
						syncId,
						updatedAt: now,
					},
				});
			}
		}

		// STEP 4: Execute batch operations (3 mutations max)
		if (toCreate.length > 0) {
			this.metrics.trackMutation();
			await this.convex.mutation(api.helpers.orm.insert_s, {
				tableName: "entities",
				tenantId,
				data: toCreate,
				secret: this.secret,
			});
			this.metrics.trackEntityCreated(toCreate.length);

			Logger.log({
				module: "EntityProcessor",
				context: "processChunk",
				message: `Created ${toCreate.length} entities`,
				level: "trace",
			});
		}

		if (toUpdate.length > 0) {
			this.metrics.trackMutation();
			await this.convex.mutation(api.helpers.orm.update_s, {
				tableName: "entities",
				data: toUpdate,
				secret: this.secret,
			});
			this.metrics.trackEntityUpdated(toUpdate.length);

			Logger.log({
				module: "EntityProcessor",
				context: "processChunk",
				message: `Updated ${toUpdate.length} entities`,
				level: "trace",
			});
		}

		if (toTouch.length > 0) {
			this.metrics.trackMutation();
			await this.convex.mutation(api.helpers.orm.update_s, {
				tableName: "entities",
				data: toTouch,
				secret: this.secret,
			});
			this.metrics.trackEntityUnchanged(toTouch.length);

			Logger.log({
				module: "EntityProcessor",
				context: "processChunk",
				message: `Touched ${toTouch.length} unchanged entities`,
				level: "trace",
			});
		}
	}

	/**
	 * Calculate SHA-256 hash of rawData for change detection
	 */
	private calculateHash(data: any): string {
		const jsonString = JSON.stringify(data, Object.keys(data).sort());
		return crypto.createHash("sha256").update(jsonString).digest("hex");
	}

	/**
	 * Split array into chunks
	 */
	private chunkArray<T>(array: T[], chunkSize: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < array.length; i += chunkSize) {
			chunks.push(array.slice(i, i + chunkSize));
		}
		return chunks;
	}

	/**
	 * Trigger linking stage after processing
	 */
	private async triggerLinking(
		integrationId: IntegrationId,
		tenantId: Id<"tenants">,
		dataSourceId: Id<"data_sources">,
		syncId: string,
		siteId?: string,
		startedAt?: number,
		entityType?: EntityType,
	): Promise<void> {
		const queueName = QueueNames.link(integrationId);

		await queueManager.addJob(
			queueName,
			{
				tenantId,
				integrationId,
				dataSourceId,
				siteId,
				syncId,
				startedAt,
				entityType, // Pass entityType for job_history tracking
				metrics: this.metrics.toJSON(), // Pass accumulated metrics (adapter + processor)
			},
			{
				priority: 5,
			},
		);

		Logger.log({
			module: "EntityProcessor",
			context: "triggerLinking",
			message: `Triggered linking job for ${integrationId} with accumulated metrics`,
			level: "info",
		});
	}

	/**
	 * Get current metrics
	 */
	getMetrics(): any {
		return this.metrics.getMetrics();
	}

	/**
	 * Stop the processor worker
	 */
	async stop(): Promise<void> {
		await queueManager.closeAll();

		Logger.log({
			module: "EntityProcessor",
			context: "stop",
			message: "EntityProcessor worker stopped",
			level: "info",
		});
	}
}
