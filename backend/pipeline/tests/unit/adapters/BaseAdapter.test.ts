/**
 * Tests for BaseAdapter pagination functionality
 * Tests the cursor-based pagination implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAdapter, type RawDataProps, type RawDataResult } from '@workspace/pipeline/adapters/BaseAdapter.js';
import { MockNatsClient } from '../../mocks/nats.mock.js';
import { MockConvexClient } from '../../mocks/convex.mock.js';
import { jobFixtures, dataSourceFixtures, mockId } from '../../fixtures/entities.fixture.js';
import type { SyncEventPayload } from '@workspace/shared/types/pipeline/index.js';
import type { APIResponse } from '@workspace/shared/types/api.js';

// Create a test adapter by extending BaseAdapter
class TestAdapter extends BaseAdapter {
  public testData: any[] = [];
  public pageSize: number = 100;

  constructor() {
    super('microsoft-365', ['identities']);
  }

  async getRawData(props: RawDataProps): Promise<APIResponse<RawDataResult>> {
    const { cursor } = props;
    const offset = cursor ? parseInt(cursor) : 0;

    // Simulate pagination
    const data = this.testData.slice(offset, offset + this.pageSize);
    const hasMore = offset + this.pageSize < this.testData.length;
    const nextCursor = hasMore ? (offset + this.pageSize).toString() : undefined;

    return {
      data: {
        data: data.map((item) => ({
          ...item,
          externalID: item.id,
          dataHash: `hash-${item.id}`,
        })),
        nextCursor,
        hasMore,
      },
    };
  }
}

describe('BaseAdapter - Pagination', () => {
  let adapter: TestAdapter;
  let mockNats: MockNatsClient;
  let mockConvex: MockConvexClient;

  beforeEach(() => {
    // Create mock instances
    mockNats = new MockNatsClient();
    mockConvex = new MockConvexClient();

    // Mock the module imports
    vi.mock('@workspace/pipeline/helpers/nats.js', () => ({
      natsClient: mockNats,
    }));
    vi.mock('@workspace/shared/lib/convex.js', () => ({
      client: mockConvex,
    }));

    // Create adapter instance
    adapter = new TestAdapter();

    // Setup test data source in mock Convex
    mockConvex.insertEntity('data_sources', dataSourceFixtures.activeDataSource);

    // Connect mock NATS
    mockNats.connect();
  });

  describe('Single batch (non-paginated)', () => {
    it('should process all data in one batch when dataset is small', async () => {
      // Setup: 50 users (less than page size)
      adapter.testData = Array.from({ length: 50 }, (_, i) => ({
        id: `user-${i + 1}`,
        name: `User ${i + 1}`,
      }));
      adapter.pageSize = 100;

      // Trigger sync
      const syncEvent: SyncEventPayload = {
        job: jobFixtures.firstSyncJob,
        eventID: 'event-1',
        tenantID: mockId('tenants', 'tenant1'),
        integrationID: mockId('integrations', 'integration1'),
        dataSourceID: mockId('data_sources', 'ds1'),
        integrationType: 'microsoft-365',
        entityType: 'identities',
        stage: 'sync',
        createdAt: Date.now(),
      };

      await mockNats.triggerSubscription('microsoft-365.sync.identities', syncEvent);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Published fetched event with all data
      const publishedMessages = mockNats.getPublishedMessages();
      expect(publishedMessages).toHaveLength(1);

      const fetchedEvent = publishedMessages[0];
      expect(fetchedEvent.subject).toContain('fetched.identities');
      expect(fetchedEvent.data.total).toBe(50);
      expect(fetchedEvent.data.hasMore).toBe(false);
      expect(fetchedEvent.data.syncMetadata.isFinalBatch).toBe(true);
      expect(fetchedEvent.data.syncMetadata.cursor).toBeUndefined();

      // Assert: Job completed
      const jobs = mockConvex.getTable('scheduled_jobs');
      expect(jobs[0].status).toBe('completed');

      // Assert: Data source updated to idle
      const dataSource = mockConvex.getEntity('data_sources', mockId('data_sources', 'ds1'));
      expect(dataSource.syncStatus).toBe('idle');
      expect(dataSource.currentSyncId).toBeUndefined();
    });
  });

  describe('Multi-batch pagination', () => {
    it('should process first batch and schedule next batch when more data exists', async () => {
      // Setup: 250 users (more than page size of 100)
      adapter.testData = Array.from({ length: 250 }, (_, i) => ({
        id: `user-${i + 1}`,
        name: `User ${i + 1}`,
      }));
      adapter.pageSize = 100;

      // Trigger first batch
      const syncEvent: SyncEventPayload = {
        job: jobFixtures.firstSyncJob,
        eventID: 'event-1',
        tenantID: mockId('tenants', 'tenant1'),
        integrationID: mockId('integrations', 'integration1'),
        dataSourceID: mockId('data_sources', 'ds1'),
        integrationType: 'microsoft-365',
        entityType: 'identities',
        stage: 'sync',
        createdAt: Date.now(),
      };

      await mockNats.triggerSubscription('microsoft-365.sync.identities', syncEvent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Published fetched event for batch 1
      const batch1Messages = mockNats.getPublishedMessagesForSubject('fetched.identities');
      expect(batch1Messages).toHaveLength(1);

      const batch1Event = batch1Messages[0].data;
      expect(batch1Event.total).toBe(100);
      expect(batch1Event.hasMore).toBe(true);
      expect(batch1Event.syncMetadata.batchNumber).toBe(1);
      expect(batch1Event.syncMetadata.isFinalBatch).toBe(false);
      expect(batch1Event.syncMetadata.cursor).toBe('100');
      expect(batch1Event.syncMetadata.syncId).toBeDefined();

      // Assert: Next batch job scheduled
      const jobs = mockConvex.getTable('scheduled_jobs');
      const nextBatchJob = jobs.find((j: any) => j.createdBy === 'pagination');
      expect(nextBatchJob).toBeDefined();
      expect(nextBatchJob.payload.cursor).toBe('100');
      expect(nextBatchJob.payload.syncId).toBe(batch1Event.syncMetadata.syncId);
      expect(nextBatchJob.payload.batchNumber).toBe(1);
      expect(nextBatchJob.payload.totalProcessed).toBe(100);

      // Assert: Data source still syncing
      const dataSource = mockConvex.getEntity('data_sources', mockId('data_sources', 'ds1'));
      expect(dataSource.syncStatus).toBe('syncing_batch');
      expect(dataSource.currentSyncId).toBe(batch1Event.syncMetadata.syncId);
    });

    it('should maintain syncId across all batches', async () => {
      // Setup: 250 users
      adapter.testData = Array.from({ length: 250 }, (_, i) => ({
        id: `user-${i + 1}`,
        name: `User ${i + 1}`,
      }));
      adapter.pageSize = 100;

      // Process batch 1
      const syncEvent1: SyncEventPayload = {
        job: jobFixtures.firstSyncJob,
        eventID: 'event-1',
        tenantID: mockId('tenants', 'tenant1'),
        integrationID: mockId('integrations', 'integration1'),
        dataSourceID: mockId('data_sources', 'ds1'),
        integrationType: 'microsoft-365',
        entityType: 'identities',
        stage: 'sync',
        createdAt: Date.now(),
      };

      await mockNats.triggerSubscription('microsoft-365.sync.identities', syncEvent1);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const batch1Event = mockNats.getLastPublishedMessage()!.data;
      const syncId = batch1Event.syncMetadata.syncId;

      // Process batch 2
      const batch2Job = {
        ...jobFixtures.paginatedSyncJob,
        payload: {
          cursor: '100',
          syncId,
          batchNumber: 1,
          totalProcessed: 100,
        },
      };

      const syncEvent2: SyncEventPayload = {
        job: batch2Job,
        eventID: 'event-2',
        tenantID: mockId('tenants', 'tenant1'),
        integrationID: mockId('integrations', 'integration1'),
        dataSourceID: mockId('data_sources', 'ds1'),
        integrationType: 'microsoft-365',
        entityType: 'identities',
        stage: 'sync',
        createdAt: Date.now(),
      };

      await mockNats.triggerSubscription('microsoft-365.sync.identities', syncEvent2);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const batch2Event = mockNats.getLastPublishedMessage()!.data;

      // Assert: syncId is the same across batches
      expect(batch2Event.syncMetadata.syncId).toBe(syncId);
      expect(batch2Event.syncMetadata.batchNumber).toBe(2);
    });

    it('should complete sync on final batch', async () => {
      // Setup: 250 users
      adapter.testData = Array.from({ length: 250 }, (_, i) => ({
        id: `user-${i + 1}`,
        name: `User ${i + 1}`,
      }));
      adapter.pageSize = 100;

      // Skip to batch 3 (final batch: offset 200, remaining 50 users)
      const finalBatchJob = {
        ...jobFixtures.paginatedSyncJob,
        payload: {
          cursor: '200',
          syncId: 'test-sync-id',
          batchNumber: 2,
          totalProcessed: 200,
        },
      };

      const syncEvent: SyncEventPayload = {
        job: finalBatchJob,
        eventID: 'event-3',
        tenantID: mockId('tenants', 'tenant1'),
        integrationID: mockId('integrations', 'integration1'),
        dataSourceID: mockId('data_sources', 'ds1'),
        integrationType: 'microsoft-365',
        entityType: 'identities',
        stage: 'sync',
        createdAt: Date.now(),
      };

      await mockNats.triggerSubscription('microsoft-365.sync.identities', syncEvent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Published fetched event for final batch
      const finalEvent = mockNats.getLastPublishedMessage()!.data;
      expect(finalEvent.total).toBe(50); // Remaining users
      expect(finalEvent.hasMore).toBe(false);
      expect(finalEvent.syncMetadata.isFinalBatch).toBe(true);
      expect(finalEvent.syncMetadata.cursor).toBeUndefined();
      expect(finalEvent.syncMetadata.batchNumber).toBe(3);

      // Assert: No new batch scheduled
      const jobs = mockConvex.getTable('scheduled_jobs');
      const newPaginationJob = jobs.find(
        (j: any) => j.createdBy === 'pagination' && j.payload.batchNumber === 3
      );
      expect(newPaginationJob).toBeUndefined();

      // Assert: Job completed
      expect(jobs[0].status).toBe('completed');

      // Assert: Data source updated to idle
      const dataSource = mockConvex.getEntity('data_sources', mockId('data_sources', 'ds1'));
      expect(dataSource.syncStatus).toBe('idle');
      expect(dataSource.currentSyncId).toBeUndefined();
    });

    it('should increment batch numbers correctly', async () => {
      // Setup: 350 users (4 batches)
      adapter.testData = Array.from({ length: 350 }, (_, i) => ({
        id: `user-${i + 1}`,
        name: `User ${i + 1}`,
      }));
      adapter.pageSize = 100;

      const syncId = 'test-sync-id';

      // Process batches 1-3 (not final)
      for (let batch = 0; batch < 3; batch++) {
        const job = {
          ...jobFixtures.firstSyncJob,
          payload:
            batch === 0
              ? {}
              : {
                  cursor: (batch * 100).toString(),
                  syncId,
                  batchNumber: batch,
                  totalProcessed: batch * 100,
                },
        };

        const syncEvent: SyncEventPayload = {
          job,
          eventID: `event-${batch + 1}`,
          tenantID: mockId('tenants', 'tenant1'),
          integrationID: mockId('integrations', 'integration1'),
          dataSourceID: mockId('data_sources', 'ds1'),
          integrationType: 'microsoft-365',
          entityType: 'identities',
          stage: 'sync',
          createdAt: Date.now(),
        };

        await mockNats.triggerSubscription('microsoft-365.sync.identities', syncEvent);
        await new Promise((resolve) => setTimeout(resolve, 100));

        const batchEvent = mockNats.getLastPublishedMessage()!.data;
        expect(batchEvent.syncMetadata.batchNumber).toBe(batch + 1);
      }
    });
  });

  describe('SyncId propagation', () => {
    it('should include syncMetadata in FetchedEventPayload', async () => {
      // Setup
      adapter.testData = Array.from({ length: 150 }, (_, i) => ({
        id: `user-${i + 1}`,
        name: `User ${i + 1}`,
      }));
      adapter.pageSize = 100;

      // Trigger sync
      const syncEvent: SyncEventPayload = {
        job: jobFixtures.firstSyncJob,
        eventID: 'event-1',
        tenantID: mockId('tenants', 'tenant1'),
        integrationID: mockId('integrations', 'integration1'),
        dataSourceID: mockId('data_sources', 'ds1'),
        integrationType: 'microsoft-365',
        entityType: 'identities',
        stage: 'sync',
        createdAt: Date.now(),
      };

      await mockNats.triggerSubscription('microsoft-365.sync.identities', syncEvent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: syncMetadata present and complete
      const fetchedEvent = mockNats.getLastPublishedMessage()!.data;
      expect(fetchedEvent.syncMetadata).toBeDefined();
      expect(fetchedEvent.syncMetadata.syncId).toBeDefined();
      expect(fetchedEvent.syncMetadata.batchNumber).toBe(1);
      expect(fetchedEvent.syncMetadata.isFinalBatch).toBe(false);
      expect(fetchedEvent.syncMetadata.cursor).toBe('100');
    });
  });
});
