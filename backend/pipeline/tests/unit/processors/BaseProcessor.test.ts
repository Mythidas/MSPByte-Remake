/**
 * Tests for BaseProcessor syncId tracking
 * Tests the mark-and-sweep preparation logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseProcessor, type ProcessedEntityData } from '@workspace/pipeline/processors/BaseProcessor.js';
import { MockNatsClient } from '../../mocks/nats.mock.js';
import { MockConvexClient } from '../../mocks/convex.mock.js';
import { identityFixtures, mockId } from '../../fixtures/entities.fixture.js';
import type { FetchedEventPayload, DataFetchPayload } from '@workspace/shared/types/pipeline/index.js';
import type { Identity } from '@workspace/database/convex/types/normalized.js';

// Create a test processor by extending BaseProcessor
class TestIdentityProcessor extends BaseProcessor<Identity> {
  constructor() {
    super('identities', 'microsoft-365');
  }

  protected normalizeData(
    integrationType: any,
    data: DataFetchPayload[]
  ): ProcessedEntityData<Identity>[] {
    return data.map((item) => ({
      normalized: {
        name: item.name,
        email: item.email,
        enabled: item.enabled || true,
        last_login_at: item.lastLoginAt || new Date().toISOString(),
        licenses: item.licenses || [],
        tags: item.tags || [],
        state: 'normal',
      } as Identity,
      raw: item,
      hash: item.dataHash,
      externalID: item.externalID,
      siteID: item.siteID,
    }));
  }
}

describe('BaseProcessor - SyncId Tracking', () => {
  let processor: TestIdentityProcessor;
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

    // Create processor instance
    processor = new TestIdentityProcessor();

    // Connect mock NATS
    mockNats.connect();
  });

  describe('New entity creation', () => {
    it('should create new entities with current syncId', async () => {
      // Setup: Empty database
      const fetchedEvent: FetchedEventPayload = {
        eventID: 'event-1',
        tenantID: mockId('tenants', 'tenant1'),
        integrationID: mockId('integrations', 'integration1'),
        integrationType: 'microsoft-365',
        dataSourceID: mockId('data_sources', 'ds1'),
        entityType: 'identities',
        stage: 'fetched',
        createdAt: Date.now(),
        parentEventID: 'parent-event-1',
        data: [
          {
            externalID: 'user-1',
            dataHash: 'hash-1',
            name: 'John Doe',
            email: 'john@test.com',
            enabled: true,
            lastLoginAt: new Date().toISOString(),
          },
        ],
        total: 1,
        hasMore: false,
        syncMetadata: {
          syncId: 'current-sync-id',
          batchNumber: 1,
          isFinalBatch: true,
        },
      };

      await mockNats.triggerSubscription('fetched.identities', fetchedEvent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Entity created with syncId
      const entities = mockConvex.getTable('entities');
      expect(entities).toHaveLength(1);

      const entity = entities[0];
      expect(entity.syncId).toBe('current-sync-id');
      expect(entity.lastSeenAt).toBeDefined();
      expect(entity.deletedAt).toBeUndefined();
      expect(entity.externalId).toBe('user-1');
      expect(entity.dataHash).toBe('hash-1');
    });
  });

  describe('Existing entity with unchanged data', () => {
    it('should update syncId but not data fields when hash unchanged', async () => {
      // Setup: Existing entity with old syncId
      const existingEntity = {
        ...identityFixtures.activeUserWithMFA,
        syncId: 'old-sync-id',
        dataHash: 'hash-1', // Same hash
        lastSeenAt: Date.now() - 24 * 60 * 60 * 1000, // Yesterday
      };
      mockConvex.insertEntity('entities', existingEntity);

      const fetchedEvent: FetchedEventPayload = {
        eventID: 'event-1',
        tenantID: mockId('tenants', 'tenant1'),
        integrationID: mockId('integrations', 'integration1'),
        integrationType: 'microsoft-365',
        dataSourceID: mockId('data_sources', 'ds1'),
        entityType: 'identities',
        stage: 'fetched',
        createdAt: Date.now(),
        parentEventID: 'parent-event-1',
        data: [
          {
            externalID: 'user-1',
            dataHash: 'hash-1', // Same hash - data unchanged
            name: 'John Doe',
            email: 'john@test.com',
            enabled: true,
            lastLoginAt: new Date().toISOString(),
          },
        ],
        total: 1,
        hasMore: false,
        syncMetadata: {
          syncId: 'current-sync-id', // New syncId
          batchNumber: 1,
          isFinalBatch: true,
        },
      };

      await mockNats.triggerSubscription('fetched.identities', fetchedEvent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Entity updated
      const entities = mockConvex.getTable('entities');
      expect(entities).toHaveLength(1);

      const entity = entities[0];
      // SyncId and lastSeenAt SHOULD be updated
      expect(entity.syncId).toBe('current-sync-id');
      expect(entity.lastSeenAt).toBeGreaterThan(Date.now() - 1000);

      // Data fields SHOULD remain unchanged (hash same)
      expect(entity.dataHash).toBe('hash-1');
      expect(entity.normalizedData).toEqual(existingEntity.normalizedData);

      // Assert: Processed event published
      const publishedMessages = mockNats.getPublishedMessages();
      const processedEvent = publishedMessages.find((m) =>
        m.subject.includes('processed.identities')
      );
      expect(processedEvent).toBeDefined();

      // Assert: entitiesUpdated should reflect actual changes (0 in this case)
      expect(processedEvent!.data.entitiesUpdated).toBe(0);
    });
  });

  describe('Existing entity with changed data', () => {
    it('should update both syncId and data fields when hash changed', async () => {
      // Setup: Existing entity with old data
      const existingEntity = {
        ...identityFixtures.activeUserWithMFA,
        syncId: 'old-sync-id',
        dataHash: 'hash-old',
        normalizedData: {
          name: 'Old Name',
          email: 'old@test.com',
          enabled: true,
          last_login_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          licenses: [],
          tags: [],
          state: 'normal',
        },
      };
      mockConvex.insertEntity('entities', existingEntity);

      const fetchedEvent: FetchedEventPayload = {
        eventID: 'event-1',
        tenantID: mockId('tenants', 'tenant1'),
        integrationID: mockId('integrations', 'integration1'),
        integrationType: 'microsoft-365',
        dataSourceID: mockId('data_sources', 'ds1'),
        entityType: 'identities',
        stage: 'fetched',
        createdAt: Date.now(),
        parentEventID: 'parent-event-1',
        data: [
          {
            externalID: 'user-1',
            dataHash: 'hash-new', // Different hash - data changed
            name: 'New Name',
            email: 'new@test.com',
            enabled: true,
            lastLoginAt: new Date().toISOString(),
          },
        ],
        total: 1,
        hasMore: false,
        syncMetadata: {
          syncId: 'current-sync-id',
          batchNumber: 1,
          isFinalBatch: true,
        },
      };

      await mockNats.triggerSubscription('fetched.identities', fetchedEvent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Entity fully updated
      const entities = mockConvex.getTable('entities');
      expect(entities).toHaveLength(1);

      const entity = entities[0];
      // SyncId and lastSeenAt updated
      expect(entity.syncId).toBe('current-sync-id');
      expect(entity.lastSeenAt).toBeGreaterThan(Date.now() - 1000);

      // Data fields SHOULD be updated (hash changed)
      expect(entity.dataHash).toBe('hash-new');
      expect(entity.normalizedData.name).toBe('New Name');
      expect(entity.normalizedData.email).toBe('new@test.com');

      // Assert: entitiesUpdated should be 1
      const publishedMessages = mockNats.getPublishedMessages();
      const processedEvent = publishedMessages.find((m) =>
        m.subject.includes('processed.identities')
      );
      expect(processedEvent!.data.entitiesUpdated).toBe(1);
    });
  });

  describe('Soft-deleted entity restoration', () => {
    it('should clear deletedAt when soft-deleted entity returns', async () => {
      // Setup: Soft-deleted entity
      const deletedEntity = {
        ...identityFixtures.softDeletedUser,
        deletedAt: Date.now() - 24 * 60 * 60 * 1000, // Deleted yesterday
        syncId: 'old-sync-id',
      };
      mockConvex.insertEntity('entities', deletedEntity);

      const fetchedEvent: FetchedEventPayload = {
        eventID: 'event-1',
        tenantID: mockId('tenants', 'tenant1'),
        integrationID: mockId('integrations', 'integration1'),
        integrationType: 'microsoft-365',
        dataSourceID: mockId('data_sources', 'ds1'),
        entityType: 'identities',
        stage: 'fetched',
        createdAt: Date.now(),
        parentEventID: 'parent-event-1',
        data: [
          {
            externalID: 'user-6', // Same as softDeletedUser
            dataHash: 'hash-new',
            name: 'Restored User',
            email: 'deleted@test.com',
            enabled: true,
            lastLoginAt: new Date().toISOString(),
          },
        ],
        total: 1,
        hasMore: false,
        syncMetadata: {
          syncId: 'current-sync-id',
          batchNumber: 1,
          isFinalBatch: true,
        },
      };

      await mockNats.triggerSubscription('fetched.identities', fetchedEvent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Entity restored
      const entities = mockConvex.getTable('entities');
      expect(entities).toHaveLength(1);

      const entity = entities[0];
      // deletedAt SHOULD be cleared
      expect(entity.deletedAt).toBeUndefined();

      // syncId updated
      expect(entity.syncId).toBe('current-sync-id');
      expect(entity.lastSeenAt).toBeGreaterThan(Date.now() - 1000);

      // Data updated
      expect(entity.normalizedData.name).toBe('Restored User');
    });
  });

  describe('Batch processing', () => {
    it('should process all entities regardless of changes', async () => {
      // Setup: Mix of new, unchanged, and changed entities
      mockConvex.insertEntity('entities', {
        ...identityFixtures.activeUserWithMFA,
        externalId: 'user-1',
        syncId: 'old-sync-id',
        dataHash: 'hash-1',
      });

      mockConvex.insertEntity('entities', {
        ...identityFixtures.disabledUser,
        externalId: 'user-2',
        syncId: 'old-sync-id',
        dataHash: 'hash-old', // Will change
      });

      const fetchedEvent: FetchedEventPayload = {
        eventID: 'event-1',
        tenantID: mockId('tenants', 'tenant1'),
        integrationID: mockId('integrations', 'integration1'),
        integrationType: 'microsoft-365',
        dataSourceID: mockId('data_sources', 'ds1'),
        entityType: 'identities',
        stage: 'fetched',
        createdAt: Date.now(),
        parentEventID: 'parent-event-1',
        data: [
          // User 1: Unchanged
          {
            externalID: 'user-1',
            dataHash: 'hash-1', // Same
            name: 'John Doe',
            email: 'john@test.com',
            enabled: true,
          },
          // User 2: Changed
          {
            externalID: 'user-2',
            dataHash: 'hash-new', // Different
            name: 'Jane Updated',
            email: 'jane@test.com',
            enabled: true,
          },
          // User 3: New
          {
            externalID: 'user-3',
            dataHash: 'hash-3',
            name: 'Bob New',
            email: 'bob@test.com',
            enabled: true,
          },
        ],
        total: 3,
        hasMore: false,
        syncMetadata: {
          syncId: 'current-sync-id',
          batchNumber: 1,
          isFinalBatch: true,
        },
      };

      await mockNats.triggerSubscription('fetched.identities', fetchedEvent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: All 3 entities exist
      const entities = mockConvex.getTable('entities');
      expect(entities).toHaveLength(3);

      // Assert: ALL entities have current syncId (even unchanged ones)
      for (const entity of entities) {
        expect(entity.syncId).toBe('current-sync-id');
        expect(entity.lastSeenAt).toBeGreaterThan(Date.now() - 1000);
      }

      // Assert: Stats are accurate
      const publishedMessages = mockNats.getPublishedMessages();
      const processedEvent = publishedMessages.find((m) =>
        m.subject.includes('processed.identities')
      );

      expect(processedEvent!.data.entitiesCreated).toBe(1); // User 3
      expect(processedEvent!.data.entitiesUpdated).toBe(1); // User 2 (only data changes count)
      expect(processedEvent!.data.entityIDs).toHaveLength(3); // All entities
    });
  });

  describe('SyncMetadata propagation', () => {
    it('should forward syncMetadata to processed event', async () => {
      const fetchedEvent: FetchedEventPayload = {
        eventID: 'event-1',
        tenantID: mockId('tenants', 'tenant1'),
        integrationID: mockId('integrations', 'integration1'),
        integrationType: 'microsoft-365',
        dataSourceID: mockId('data_sources', 'ds1'),
        entityType: 'identities',
        stage: 'fetched',
        createdAt: Date.now(),
        parentEventID: 'parent-event-1',
        data: [
          {
            externalID: 'user-1',
            dataHash: 'hash-1',
            name: 'Test User',
            email: 'test@test.com',
          },
        ],
        total: 1,
        hasMore: true,
        syncMetadata: {
          syncId: 'test-sync-id',
          batchNumber: 2,
          isFinalBatch: false,
          cursor: '100',
        },
      };

      await mockNats.triggerSubscription('fetched.identities', fetchedEvent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: syncMetadata forwarded to processed event
      const publishedMessages = mockNats.getPublishedMessages();
      const processedEvent = publishedMessages.find((m) =>
        m.subject.includes('processed.identities')
      );

      expect(processedEvent!.data.syncMetadata).toBeDefined();
      expect(processedEvent!.data.syncMetadata.syncId).toBe('test-sync-id');
      expect(processedEvent!.data.syncMetadata.batchNumber).toBe(2);
      expect(processedEvent!.data.syncMetadata.isFinalBatch).toBe(false);
      expect(processedEvent!.data.syncMetadata.cursor).toBe('100');
    });
  });
});
