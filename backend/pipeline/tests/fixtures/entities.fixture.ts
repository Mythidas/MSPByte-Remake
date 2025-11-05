/**
 * Test fixtures for entities
 * Reusable test data representing realistic scenarios
 */

import type { Id } from '@workspace/database/convex/_generated/dataModel.js';
import type {
  Identity,
  Group,
  Policy,
  License,
  Role,
} from '@workspace/database/convex/types/normalized.js';

/**
 * Helper to create mock ID
 */
export function mockId<T extends string>(tableName: T, id: string): Id<T> {
  return `${tableName}_${id}` as Id<T>;
}

/**
 * Identity fixtures
 */
export const identityFixtures = {
  /**
   * Active user with MFA
   */
  activeUserWithMFA: {
    _id: mockId('entities', '1'),
    _creationTime: Date.now(),
    tenantId: mockId('tenants', 'tenant1'),
    integrationId: mockId('integrations', 'integration1'),
    dataSourceId: mockId('data_sources', 'ds1'),
    externalId: 'user-1',
    entityType: 'identities' as const,
    dataHash: 'hash-1',
    normalizedData: {
      name: 'John Doe',
      email: 'john@test.com',
      enabled: true,
      last_login_at: new Date().toISOString(),
      licenses: [],
      tags: ['MFA'],
      state: 'normal',
    } as Identity,
    rawData: {},
    syncId: 'sync-1',
    lastSeenAt: Date.now(),
  },

  /**
   * Disabled user
   */
  disabledUser: {
    _id: mockId('entities', '2'),
    _creationTime: Date.now(),
    tenantId: mockId('tenants', 'tenant1'),
    integrationId: mockId('integrations', 'integration1'),
    dataSourceId: mockId('data_sources', 'ds1'),
    externalId: 'user-2',
    entityType: 'identities' as const,
    dataHash: 'hash-2',
    normalizedData: {
      name: 'Jane Smith',
      email: 'jane@test.com',
      enabled: false,
      last_login_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days ago
      licenses: ['license-1'],
      tags: [],
      state: 'normal',
    } as Identity,
    rawData: {},
    syncId: 'sync-1',
    lastSeenAt: Date.now(),
  },

  /**
   * Stale user (90+ days inactive)
   */
  staleUser: {
    _id: mockId('entities', '3'),
    _creationTime: Date.now(),
    tenantId: mockId('tenants', 'tenant1'),
    integrationId: mockId('integrations', 'integration1'),
    dataSourceId: mockId('data_sources', 'ds1'),
    externalId: 'user-3',
    entityType: 'identities' as const,
    dataHash: 'hash-3',
    normalizedData: {
      name: 'Bob Johnson',
      email: 'bob@test.com',
      enabled: true,
      last_login_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days ago
      licenses: ['license-1'],
      tags: ['Stale'],
      state: 'warn',
    } as Identity,
    rawData: {},
    syncId: 'sync-1',
    lastSeenAt: Date.now(),
  },

  /**
   * Admin user
   */
  adminUser: {
    _id: mockId('entities', '4'),
    _creationTime: Date.now(),
    tenantId: mockId('tenants', 'tenant1'),
    integrationId: mockId('integrations', 'integration1'),
    dataSourceId: mockId('data_sources', 'ds1'),
    externalId: 'user-4',
    entityType: 'identities' as const,
    dataHash: 'hash-4',
    normalizedData: {
      name: 'Admin User',
      email: 'admin@test.com',
      enabled: true,
      last_login_at: new Date().toISOString(),
      licenses: ['license-1'],
      tags: ['Admin', 'MFA'],
      state: 'normal',
    } as Identity,
    rawData: {},
    syncId: 'sync-1',
    lastSeenAt: Date.now(),
  },

  /**
   * User with old syncId (will be deleted)
   */
  userWithOldSyncId: {
    _id: mockId('entities', '5'),
    _creationTime: Date.now(),
    tenantId: mockId('tenants', 'tenant1'),
    integrationId: mockId('integrations', 'integration1'),
    dataSourceId: mockId('data_sources', 'ds1'),
    externalId: 'user-5',
    entityType: 'identities' as const,
    dataHash: 'hash-5',
    normalizedData: {
      name: 'Old User',
      email: 'old@test.com',
      enabled: true,
      last_login_at: new Date().toISOString(),
      licenses: [],
      tags: [],
      state: 'normal',
    } as Identity,
    rawData: {},
    syncId: 'old-sync-id', // Different syncId - should be deleted
    lastSeenAt: Date.now() - 24 * 60 * 60 * 1000, // Yesterday
  },

  /**
   * Soft-deleted user
   */
  softDeletedUser: {
    _id: mockId('entities', '6'),
    _creationTime: Date.now(),
    tenantId: mockId('tenants', 'tenant1'),
    integrationId: mockId('integrations', 'integration1'),
    dataSourceId: mockId('data_sources', 'ds1'),
    externalId: 'user-6',
    entityType: 'identities' as const,
    dataHash: 'hash-6',
    normalizedData: {
      name: 'Deleted User',
      email: 'deleted@test.com',
      enabled: true,
      last_login_at: new Date().toISOString(),
      licenses: [],
      tags: [],
      state: 'normal',
    } as Identity,
    rawData: {},
    syncId: 'old-sync-id',
    lastSeenAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
    deletedAt: Date.now() - 24 * 60 * 60 * 1000, // Deleted yesterday
  },
};

/**
 * Policy fixtures
 */
export const policyFixtures = {
  /**
   * Security defaults policy
   */
  securityDefaults: {
    _id: mockId('entities', 'policy-1'),
    _creationTime: Date.now(),
    tenantId: mockId('tenants', 'tenant1'),
    integrationId: mockId('integrations', 'integration1'),
    dataSourceId: mockId('data_sources', 'ds1'),
    externalId: 'security-defaults',
    entityType: 'policies' as const,
    dataHash: 'hash-policy-1',
    normalizedData: {
      name: 'Security Defaults',
      status: 'disabled',
    } as Policy,
    rawData: {},
    syncId: 'sync-1',
    lastSeenAt: Date.now(),
  },

  /**
   * MFA conditional access policy
   */
  mfaPolicy: {
    _id: mockId('entities', 'policy-2'),
    _creationTime: Date.now(),
    tenantId: mockId('tenants', 'tenant1'),
    integrationId: mockId('integrations', 'integration1'),
    dataSourceId: mockId('data_sources', 'ds1'),
    externalId: 'policy-mfa',
    entityType: 'policies' as const,
    dataHash: 'hash-policy-2',
    normalizedData: {
      name: 'Require MFA for All Users',
      status: 'enabled',
    } as Policy,
    rawData: {
      conditions: {
        users: {
          includeUsers: ['All'],
          excludeUsers: [],
          includeGroups: [],
        },
      },
      grantControls: {
        builtInControls: ['mfa'],
      },
    },
    syncId: 'sync-1',
    lastSeenAt: Date.now(),
  },
};

/**
 * Job fixtures
 */
export const jobFixtures = {
  /**
   * First sync job (no cursor)
   */
  firstSyncJob: {
    _id: mockId('scheduled_jobs', 'job-1'),
    _creationTime: Date.now(),
    tenantId: mockId('tenants', 'tenant1'),
    integrationId: mockId('integrations', 'integration1'),
    integrationSlug: 'microsoft-365',
    dataSourceId: mockId('data_sources', 'ds1'),
    action: 'sync.identities',
    priority: 1,
    status: 'running' as const,
    attempts: 0,
    attemptsMax: 3,
    scheduledAt: Date.now(),
    startedAt: Date.now(),
    createdBy: 'system',
    updatedAt: Date.now(),
    payload: {},
  },

  /**
   * Paginated sync job (with cursor)
   */
  paginatedSyncJob: {
    _id: mockId('scheduled_jobs', 'job-2'),
    _creationTime: Date.now(),
    tenantId: mockId('tenants', 'tenant1'),
    integrationId: mockId('integrations', 'integration1'),
    integrationSlug: 'microsoft-365',
    dataSourceId: mockId('data_sources', 'ds1'),
    action: 'sync.identities',
    priority: 1,
    status: 'running' as const,
    attempts: 0,
    attemptsMax: 3,
    scheduledAt: Date.now(),
    startedAt: Date.now(),
    createdBy: 'pagination',
    updatedAt: Date.now(),
    payload: {
      cursor: '100', // Offset 100
      syncId: 'sync-1',
      batchNumber: 1,
      totalProcessed: 100,
    },
  },
};

/**
 * Data source fixtures
 */
export const dataSourceFixtures = {
  /**
   * Active data source
   */
  activeDataSource: {
    _id: mockId('data_sources', 'ds1'),
    _creationTime: Date.now(),
    tenantId: mockId('tenants', 'tenant1'),
    integrationId: mockId('integrations', 'integration1'),
    name: 'Test Data Source',
    syncStatus: 'idle' as const,
    metadata: {},
  },

  /**
   * Syncing data source
   */
  syncingDataSource: {
    _id: mockId('data_sources', 'ds2'),
    _creationTime: Date.now(),
    tenantId: mockId('tenants', 'tenant1'),
    integrationId: mockId('integrations', 'integration1'),
    name: 'Syncing Data Source',
    syncStatus: 'syncing_batch' as const,
    currentSyncId: 'sync-1',
    metadata: {},
  },
};

/**
 * Create a batch of test users for pagination testing
 */
export function createTestUsers(count: number, syncId: string = 'sync-1'): any[] {
  const users = [];

  for (let i = 1; i <= count; i++) {
    users.push({
      _id: mockId('entities', `user-${i}`),
      _creationTime: Date.now(),
      tenantId: mockId('tenants', 'tenant1'),
      integrationId: mockId('integrations', 'integration1'),
      dataSourceId: mockId('data_sources', 'ds1'),
      externalId: `user-${i}`,
      entityType: 'identities' as const,
      dataHash: `hash-${i}`,
      normalizedData: {
        name: `User ${i}`,
        email: `user${i}@test.com`,
        enabled: true,
        last_login_at: new Date().toISOString(),
        licenses: [],
        tags: [],
        state: 'normal',
      } as Identity,
      rawData: {},
      syncId,
      lastSeenAt: Date.now(),
    });
  }

  return users;
}
