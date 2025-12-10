import { natsClient } from '../lib/nats.js';
import QueueManager from '../queue/QueueManager.js';
import { api } from '@workspace/database/convex/_generated/api.js';
import { client } from '@workspace/shared/lib/convex.js';
import type { Doc } from '@workspace/database/convex/_generated/dataModel.js';
import Logger from '../lib/logger.js';
import TracingManager from '../lib/tracing.js';
import { APIResponse } from '@workspace/shared/types/api.js';
import {
  IntegrationType,
  EntityType,
} from '@workspace/shared/types/pipeline/core.js';
import {
  SyncEventPayload,
  DataFetchPayload,
  FetchedEventPayload,
} from '@workspace/shared/types/pipeline/events.js';
import { generateUUID } from '@workspace/shared/lib/utils.server.js';

export type RawDataProps = {
  eventData: SyncEventPayload;
  tenantID: string;
  dataSource: Doc<'data_sources'>;
  cursor?: string;
  syncId: string;
  batchNumber: number;
};

export type RawDataResult = {
  data: DataFetchPayload[];
  nextCursor?: string;
  hasMore: boolean;
};

export abstract class BaseAdapter {
  protected queueManager: QueueManager | null = null;

  constructor(
    protected integrationType: IntegrationType,
    protected supportedEntities: EntityType[]
  ) {}

  setQueueManager(queueManager: QueueManager): void {
    this.queueManager = queueManager;
  }

  async start(): Promise<void> {
    // Subscribe to sync topics for this integration type
    const pattern = `${this.integrationType}.sync.*`;
    await natsClient.subscribe(pattern, this.handleJob.bind(this));

    Logger.log({
      module: 'BaseAdapter',
      context: this.integrationType,
      message: `Adapter started, listening to ${pattern}`,
    });
  }

  private async handleJob(syncEvent: SyncEventPayload): Promise<void> {
    const { entityType, job, tenantID, dataSourceID } = syncEvent;

    // Start trace
    TracingManager.startTrace({
      syncId: syncEvent.syncId,
      tenantId: tenantID,
      dataSourceId: dataSourceID,
      stage: 'fetch',
      metadata: {
        entityType,
        integration: this.integrationType,
      },
    });

    Logger.startStage('fetch', {
      entityType,
      integration: this.integrationType,
    });

    // Validate this adapter supports the requested entity type
    if (!this.supportedEntities.includes(entityType)) {
      Logger.log({
        module: 'BaseAdapter',
        context: 'handleJob',
        message: `Adapter ${this.integrationType} does not support entity type ${entityType}`,
        level: 'error',
      });
      return;
    }

    // Extract pagination metadata
    const jobMetadata = syncEvent.syncMetadata as any;
    const cursor = jobMetadata?.cursor;
    const syncId = syncEvent.syncId || generateUUID();
    const batchNumber = (jobMetadata?.batchNumber || 0) + 1;
    const previousTotal = jobMetadata?.totalProcessed || 0;

    Logger.log({
      module: 'BaseAdapter',
      context: 'handleJob',
      message: `Processing sync (batch ${batchNumber}, syncId: ${syncId})`,
      metadata: {
        entityType,
        batchNumber,
        cursor: cursor ? 'present' : 'none',
      },
    });

    try {
      // Fetch data source
      const dataSource = (await client.query(api.helpers.orm.get_s, {
        id: dataSourceID as any,
        tableName: 'data_sources',
        secret: process.env.CONVEX_API_KEY!,
      })) as Doc<'data_sources'>;

      if (!dataSource) {
        throw new Error('Data source not found');
      }

      // Call child class to get raw data
      const result = await this.getRawData({
        eventData: syncEvent,
        tenantID,
        dataSource,
        cursor,
        syncId,
        batchNumber,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      const { data, nextCursor, hasMore } = result.data!;
      const totalProcessed = previousTotal + data.length;

      Logger.log({
        module: 'BaseAdapter',
        context: 'handleJob',
        message: `Fetched ${data.length} ${entityType} (batch ${batchNumber})`,
        metadata: {
          batchSize: data.length,
          totalProcessed,
          hasMore,
        },
      });

      // Publish fetched data to processor
      const fetchedPayload: FetchedEventPayload = {
        tenantID,
        dataSourceID,
        integrationType: this.integrationType,
        entityType,
        data,
        syncId,
        syncMetadata: {
          syncId,
          batchNumber,
          isFinalBatch: !hasMore,
        }
      };

      await natsClient.publish('fetched', fetchedPayload);

      // Schedule next batch if needed
      if (hasMore && nextCursor) {
        Logger.log({
          module: 'BaseAdapter',
          context: 'handleJob',
          message: `Scheduling next batch (batch ${batchNumber + 1})`,
        });

        await this.queueManager?.scheduleNextBatch({
          action: `${this.integrationType}.sync.${entityType}`,
          tenantId: tenantID,
          dataSourceId: dataSourceID,
          syncId,
          cursor: nextCursor,
          batchNumber,
          priority: 10, // High priority for in-progress syncs
        });
      } else {
        Logger.log({
          module: 'BaseAdapter',
          context: 'handleJob',
          message: `Sync complete for ${entityType}`,
          metadata: {
            totalProcessed,
            batches: batchNumber,
          },
        });
      }

      Logger.endStage('fetch', {
        recordsFetched: data.length,
        totalProcessed,
      });
    } catch (error) {
      Logger.log({
        module: 'BaseAdapter',
        context: 'handleJob',
        message: `Failed to fetch ${entityType}`,
        level: 'error',
        error: error as Error,
      });

      throw error;
    }
  }

  protected abstract getRawData(
    props: RawDataProps
  ): Promise<APIResponse<RawDataResult>>;
}
