/**
 * Mock Convex database client for testing
 * Simulates Convex database operations in-memory
 */

import { vi } from 'vitest';

type Id<T extends string> = string & { __tableName: T };

interface BaseEntity {
  _id: Id<any>;
  _creationTime: number;
  tenantId?: Id<'tenants'>;
}

/**
 * Mock Convex client that stores data in-memory
 */
export class MockConvexClient {
  private tables: Map<string, Map<string, any>> = new Map();
  private idCounters: Map<string, number> = new Map();

  constructor() {
    // Initialize common tables
    this.tables.set('entities', new Map());
    this.tables.set('entity_alerts', new Map());
    this.tables.set('entity_relationships', new Map());
    this.tables.set('scheduled_jobs', new Map());
    this.tables.set('data_sources', new Map());
    this.tables.set('integrations', new Map());
    this.tables.set('tenants', new Map());
  }

  /**
   * Query: Get single entity by ID
   */
  async query(api: any, params: any): Promise<any> {
    const { tableName, id, secret, index, tenantId, filters } = params;

    // Get by ID
    if (id) {
      const table = this.tables.get(tableName);
      if (!table) return null;
      return table.get(id) || null;
    }

    // List with index/filters
    const table = this.tables.get(tableName);
    if (!table) return [];

    let results = Array.from(table.values());

    // Filter by tenantId if provided
    if (tenantId) {
      results = results.filter((entity) => entity.tenantId === tenantId);
    }

    // Apply index filters
    if (index?.params) {
      results = this.applyIndexFilter(results, index.name, index.params);
    }

    // Apply additional filters
    if (filters) {
      results = this.applyFilters(results, filters);
    }

    return results;
  }

  /**
   * Mutation: Insert entities
   */
  async mutation(api: any, params: any): Promise<any> {
    const { tableName, data, secret, tenantId } = params;

    // Handle insert_s (bulk insert)
    if (Array.isArray(data)) {
      const ids: Id<any>[] = [];

      for (const item of data) {
        const id = this.generateId(tableName);
        const entity = {
          ...item,
          _id: id,
          _creationTime: Date.now(),
          tenantId: item.tenantId || tenantId,
        };

        const table = this.getOrCreateTable(tableName);
        table.set(id, entity);
        ids.push(id);
      }

      return ids;
    }

    // Handle update_s (bulk update)
    if (data && data[0]?.id) {
      const ids: Id<any>[] = [];
      const table = this.getOrCreateTable(tableName);

      for (const update of data) {
        const existing = table.get(update.id);
        if (existing) {
          const updated = {
            ...existing,
            ...update.updates,
          };
          table.set(update.id, updated);
          ids.push(update.id);
        }
      }

      return ids;
    }

    return [];
  }

  /**
   * Apply index-based filtering
   */
  private applyIndexFilter(results: any[], indexName: string, params: any): any[] {
    switch (indexName) {
      case 'by_integration_type':
        return results.filter(
          (entity) =>
            entity.integrationId === params.integrationId &&
            entity.entityType === params.entityType
        );

      case 'by_data_source':
        return results.filter(
          (entity) => entity.dataSourceId === params.dataSourceId
        );

      case 'by_data_source_type':
        return results.filter(
          (entity) =>
            entity.dataSourceId === params.dataSourceId &&
            entity.entityType === params.entityType
        );

      case 'by_entity_status':
        return results.filter(
          (entity) =>
            entity.entityId === params.entityId && entity.status === params.status
        );

      case 'by_external_id':
        return results.filter((entity) => entity.externalId === params.externalId);

      case 'by_status':
        return results.filter((entity) => entity.status === params.status);

      case 'by_child':
        return results.filter(
          (entity) => entity.childEntityId === params.childEntityId
        );

      case 'by_parent':
        return results.filter(
          (entity) => entity.parentEntityId === params.parentEntityId
        );

      default:
        return results;
    }
  }

  /**
   * Apply additional filters
   */
  private applyFilters(results: any[], filters: Record<string, any>): any[] {
    return results.filter((entity) => {
      for (const [key, value] of Object.entries(filters)) {
        if (entity[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Generate unique ID for table
   */
  private generateId(tableName: string): Id<any> {
    const counter = this.idCounters.get(tableName) || 0;
    const newCounter = counter + 1;
    this.idCounters.set(tableName, newCounter);
    return `${tableName}_${newCounter}` as Id<any>;
  }

  /**
   * Get or create table
   */
  private getOrCreateTable(tableName: string): Map<string, any> {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, new Map());
    }
    return this.tables.get(tableName)!;
  }

  // ========== Test Helper Methods ==========

  /**
   * Get all entities from a table
   */
  getTable(tableName: string): any[] {
    const table = this.tables.get(tableName);
    return table ? Array.from(table.values()) : [];
  }

  /**
   * Get entity by ID
   */
  getEntity(tableName: string, id: Id<any>): any | undefined {
    const table = this.tables.get(tableName);
    return table?.get(id);
  }

  /**
   * Insert entity directly (for test setup)
   */
  insertEntity(tableName: string, entity: any): Id<any> {
    const id = entity._id || this.generateId(tableName);
    const table = this.getOrCreateTable(tableName);

    const fullEntity = {
      ...entity,
      _id: id,
      _creationTime: entity._creationTime || Date.now(),
    };

    table.set(id, fullEntity);
    return id;
  }

  /**
   * Update entity directly (for test setup)
   */
  updateEntity(tableName: string, id: Id<any>, updates: any): void {
    const table = this.getOrCreateTable(tableName);
    const existing = table.get(id);

    if (existing) {
      table.set(id, { ...existing, ...updates });
    }
  }

  /**
   * Delete entity directly (for test setup)
   */
  deleteEntity(tableName: string, id: Id<any>): void {
    const table = this.tables.get(tableName);
    table?.delete(id);
  }

  /**
   * Clear all data from a table
   */
  clearTable(tableName: string): void {
    const table = this.tables.get(tableName);
    table?.clear();
  }

  /**
   * Clear all tables
   */
  reset(): void {
    for (const table of this.tables.values()) {
      table.clear();
    }
    this.idCounters.clear();
  }

  /**
   * Get count of entities in a table
   */
  getTableCount(tableName: string): number {
    const table = this.tables.get(tableName);
    return table?.size || 0;
  }

  /**
   * Check if entity exists
   */
  entityExists(tableName: string, id: Id<any>): boolean {
    const table = this.tables.get(tableName);
    return table?.has(id) || false;
  }
}

/**
 * Create a new mock Convex client instance
 */
export function createMockConvexClient(): MockConvexClient {
  return new MockConvexClient();
}

/**
 * Factory for creating a mock client module
 * Usage in tests: vi.mock('@workspace/shared/lib/convex.js', () => ({ client: createMockConvexModule() }))
 */
export function createMockConvexModule(): MockConvexClient {
  return createMockConvexClient();
}

/**
 * Mock api object (used as first parameter to client.query/mutation)
 */
export const mockApi = {
  helpers: {
    orm: {
      get_s: 'get_s',
      list_s: 'list_s',
      insert_s: 'insert_s',
      update_s: 'update_s',
    },
  },
};
