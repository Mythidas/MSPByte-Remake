import { Job, Worker } from "bullmq";
import { v4 as uuid } from "uuid";
import { SyncJobData, QueueNames, queueManager } from "../lib/queue.js";
import { MetricsCollector } from "../lib/metrics.js";
import { Logger } from "../lib/logger.js";
import { AdapterFetchResult, RawEntity } from "../types.js";
import type {
	IntegrationId,
	EntityType,
} from "@workspace/shared/types/integrations";
import { INTEGRATIONS } from "@workspace/shared/types/integrations/config";

/**
 * BaseAdapter - Abstract base class for all integration adapters
 *
 * Responsibilities:
 * 1. Subscribe to BullMQ sync:{integration}:{type} queue
 * 2. Fetch data from external API (implemented by concrete adapters)
 * 3. Handle pagination
 * 4. Publish batches to process:entity queue
 * 5. Track metrics (API calls, duration)
 * 6. Self-schedule next sync based on integration config
 */
export abstract class BaseAdapter {
	protected metrics: MetricsCollector;
	protected integrationId: IntegrationId;
	private workers: Map<EntityType, Worker<SyncJobData>> = new Map();

	constructor(integrationId: IntegrationId) {
		this.metrics = new MetricsCollector();
		this.integrationId = integrationId;
	}

	/**
	 * Start a worker for a specific entity type
	 * Subscribes to sync:{integration}:{type} queue
	 */
	startWorkerForType(entityType: EntityType): void {
		if (this.workers.has(entityType)) {
			Logger.log({
				module: "BaseAdapter",
				context: "startWorkerForType",
				message: `Worker already exists for ${this.integrationId}:${entityType}`,
				level: "warn",
			});
			return;
		}

		const queueName = QueueNames.sync(this.integrationId, entityType);

		const worker = queueManager.createWorker<SyncJobData>(
			queueName,
			this.handleSyncJob.bind(this),
			{
				concurrency: 50, // Allow parallel syncs across tenants
			},
		);

		this.workers.set(entityType, worker);

		Logger.log({
			module: "BaseAdapter",
			context: "startWorkerForType",
			message: `${this.getAdapterName()} started worker for ${this.integrationId}:${entityType}`,
			level: "info",
		});
	}

	/**
	 * Handle sync job from queue
	 */
	private async handleSyncJob(job: Job<SyncJobData>): Promise<void> {
		const {
			tenantId,
			integrationId,
			dataSourceId,
			entityType,
			batchNumber = 0,
			syncId,
		} = job.data;

		// Set pipeline start time on first batch
		const startedAt =
			job.data.startedAt || (batchNumber === 0 ? Date.now() : undefined);

		this.metrics.reset();
		this.metrics.startStage("adapter");

		Logger.log({
			module: "BaseAdapter",
			context: "handleSyncJob",
			message: `Starting sync for ${integrationId}:${entityType} (batch ${batchNumber})`,
			level: "info",
		});

		try {
			// Fetch data from external API (implemented by concrete adapter)
			this.metrics.trackApiCall();
			const result = await this.fetchData(job.data);

			Logger.log({
				module: "BaseAdapter",
				context: "handleSyncJob",
				message: `Fetched ${result.entities.length} ${entityType} entities`,
				level: "trace",
			});

			// Publish entities to processor queue
			if (result.entities.length > 0) {
				await this.publishToProcessor(
					tenantId,
					integrationId,
					dataSourceId,
					entityType,
					result.entities,
					syncId,
					startedAt,
					result.entities[0].siteId,
				);
			}

			// Handle pagination
			if (result.pagination?.hasMore) {
				await this.scheduleNextBatch(
					job.data,
					result.pagination.cursor,
					batchNumber + 1,
					startedAt,
				);

				Logger.log({
					module: "BaseAdapter",
					context: "handleSyncJob",
					message: `Scheduled batch ${batchNumber + 1} with cursor`,
					level: "trace",
				});
			} else {
				// Sync complete - schedule next sync based on integration config
				await this.scheduleNextSync(
					tenantId,
					integrationId,
					dataSourceId,
					entityType,
				);

				Logger.log({
					module: "BaseAdapter",
					context: "handleSyncJob",
					message: `Sync complete for ${integrationId}:${entityType}`,
					level: "info",
				});
			}

			this.metrics.endStage("adapter");
		} catch (error) {
			this.metrics.trackError(error as Error, job.attemptsMade);
			this.metrics.endStage("adapter");

			Logger.log({
				module: "BaseAdapter",
				context: "handleSyncJob",
				message: `Sync failed: ${error}`,
				level: "error",
			});

			throw error; // Re-throw to trigger BullMQ retry
		}
	}

	/**
	 * Fetch data from external API
	 * Must be implemented by concrete adapters
	 */
	protected abstract fetchData(
		jobData: SyncJobData,
	): Promise<AdapterFetchResult>;

	/**
	 * Get adapter name for logging
	 */
	protected abstract getAdapterName(): string;

	/**
	 * Publish entities to processor queue
	 */
	private async publishToProcessor(
		tenantId: string,
		integrationId: IntegrationId,
		dataSourceId: string,
		entityType: EntityType,
		entities: RawEntity[],
		syncId: string,
		startedAt?: number,
		siteId?: string,
	): Promise<void> {
		await queueManager.addJob(
			QueueNames.process,
			{
				tenantId: tenantId as any,
				integrationId,
				dataSourceId: dataSourceId as any,
				entityType,
				entities,
				syncId,
				siteId,
				startedAt,
				metrics: this.metrics.toJSON(), // Pass adapter metrics to processor
			},
			{
				priority: 5,
			},
		);

		Logger.log({
			module: "BaseAdapter",
			context: "publishToProcessor",
			message: `Published ${entities.length} entities to processor with metrics`,
			level: "trace",
		});
	}

	/**
	 * Schedule next pagination batch
	 */
	private async scheduleNextBatch(
		currentJobData: SyncJobData,
		cursor: string | undefined,
		batchNumber: number,
		startedAt?: number,
	): Promise<void> {
		const queueName = QueueNames.sync(
			this.integrationId,
			currentJobData.entityType,
		);

		await queueManager.addJob(
			queueName,
			{
				...currentJobData,
				cursor,
				batchNumber,
				startedAt, // Pass startedAt to next batch
			},
			{
				priority: 5,
			},
		);
	}

	/**
	 * Schedule next sync based on integration config
	 * Checks for existing jobs to prevent duplicates
	 */
	private async scheduleNextSync(
		tenantId: string,
		integrationId: IntegrationId,
		dataSourceId: string,
		entityType: EntityType,
	): Promise<void> {
		const integration = INTEGRATIONS[integrationId];
		const typeConfig = integration.supportedTypes.find(
			(t) => t.type === entityType,
		);

		if (!typeConfig) {
			Logger.log({
				module: "BaseAdapter",
				context: "scheduleNextSync",
				message: `No config found for ${integrationId}:${entityType}`,
				level: "warn",
			});
			return;
		}

		const rateMinutes = typeConfig.rateMinutes;
		const delayMs = rateMinutes * 60 * 1000;
		const queueName = QueueNames.sync(integrationId, entityType);

		// Check if a job already exists for this datasource + entityType
		const jobExists = await queueManager.hasJobForDatasource(
			queueName,
			dataSourceId as any,
			entityType,
		);

		if (jobExists) {
			Logger.log({
				module: "BaseAdapter",
				context: "scheduleNextSync",
				message: `Skipping duplicate - job already exists for ${integrationId}:${entityType} datasource ${dataSourceId}`,
				level: "info",
			});
			return;
		}

		// Schedule next sync with delay
		await queueManager.addJob(
			queueName,
			{
				tenantId,
				integrationId,
				dataSourceId: dataSourceId as any,
				entityType,
				syncId: uuid(), // New syncId for new sync
			},
			{
				delay: delayMs,
				priority: typeConfig.priority,
			},
		);

		Logger.log({
			module: "BaseAdapter",
			context: "scheduleNextSync",
			message: `Scheduled next sync in ${rateMinutes} minutes`,
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
	 * Stop all adapter workers
	 */
	async stop(): Promise<void> {
		for (const [entityType, worker] of this.workers.entries()) {
			await worker.close();
			Logger.log({
				module: "BaseAdapter",
				context: "stop",
				message: `${this.getAdapterName()} stopped worker for ${entityType}`,
				level: "info",
			});
		}
		this.workers.clear();
	}
}
