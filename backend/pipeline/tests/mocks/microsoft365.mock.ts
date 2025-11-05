/**
 * Mock Microsoft 365 connector for testing
 * Simulates MS Graph API responses without making real API calls
 */

import { vi } from 'vitest';
import type { APIResponse } from '@workspace/shared/types/api.js';

/**
 * Mock MS Graph user response
 */
export interface MockMSGraphUser {
  id: string;
  userPrincipalName: string;
  displayName: string;
  mail: string;
  accountEnabled: boolean;
  signInActivity?: {
    lastSignInDateTime?: string;
  };
  assignedLicenses?: Array<{ skuId: string }>;
}

/**
 * Mock MS Graph group response
 */
export interface MockMSGraphGroup {
  id: string;
  displayName: string;
  mailNickname: string;
}

/**
 * Mock MS Graph role response
 */
export interface MockMSGraphRole {
  id: string;
  displayName: string;
  description: string;
}

/**
 * Mock MS Graph conditional access policy response
 */
export interface MockMSGraphPolicy {
  id: string;
  displayName: string;
  state: string;
  conditions: any;
  grantControls: any;
}

/**
 * Mock MS Graph license (SKU) response
 */
export interface MockMSGraphSubscribedSku {
  skuId: string;
  skuPartNumber: string;
  consumedUnits: number;
  prepaidUnits: {
    enabled: number;
    suspended: number;
    warning: number;
  };
}

/**
 * Mock Microsoft 365 connector
 */
export class MockMicrosoft365Connector {
  private identities: MockMSGraphUser[] = [];
  private groups: MockMSGraphGroup[] = [];
  private roles: MockMSGraphRole[] = [];
  private policies: MockMSGraphPolicy[] = [];
  private licenses: MockMSGraphSubscribedSku[] = [];
  private pageSize: number = 100;

  constructor() {
    // Initialize with some default test data
    this.seedTestData();
  }

  /**
   * Check health (always returns healthy in mock)
   */
  async checkHealth(): Promise<APIResponse<{ status: string }>> {
    return {
      data: { status: 'healthy' },
    };
  }

  /**
   * Get identities with pagination support
   */
  async getIdentities({
    domains,
    cursor,
  }: {
    domains: string[];
    cursor?: string;
  }): Promise<
    APIResponse<{ users: MockMSGraphUser[]; '@odata.nextLink'?: string }>
  > {
    // Parse cursor to get offset
    const offset = cursor ? parseInt(cursor) : 0;

    // Slice data for pagination
    const users = this.identities.slice(offset, offset + this.pageSize);

    // Generate next cursor if more data exists
    const hasMore = offset + this.pageSize < this.identities.length;
    const nextCursor = hasMore ? (offset + this.pageSize).toString() : undefined;

    return {
      data: {
        users,
        '@odata.nextLink': nextCursor,
      },
    };
  }

  /**
   * Get groups (non-paginated for simplicity)
   */
  async getGroups(): Promise<APIResponse<MockMSGraphGroup[]>> {
    return {
      data: this.groups,
    };
  }

  /**
   * Get roles (non-paginated)
   */
  async getRoles(): Promise<APIResponse<MockMSGraphRole[]>> {
    return {
      data: this.roles,
    };
  }

  /**
   * Get conditional access policies
   */
  async getConditionalAccessPolicies(): Promise<
    APIResponse<MockMSGraphPolicy[]>
  > {
    return {
      data: this.policies,
    };
  }

  /**
   * Check if security defaults are enabled
   */
  async getSecurityDefaultsEnabled(): Promise<APIResponse<boolean>> {
    return {
      data: false, // Default to false in tests
    };
  }

  /**
   * Get subscribed licenses (SKUs)
   */
  async getSubscribedSkus(): Promise<APIResponse<MockMSGraphSubscribedSku[]>> {
    return {
      data: this.licenses,
    };
  }

  /**
   * Get group members
   */
  async getGroupMembers(groupId: string): Promise<APIResponse<any[]>> {
    return {
      data: [],
    };
  }

  /**
   * Get role members
   */
  async getRoleMembers(roleId: string): Promise<APIResponse<any[]>> {
    return {
      data: [],
    };
  }

  /**
   * Get organization info
   */
  async getOrganization(): Promise<APIResponse<any>> {
    return {
      data: {
        id: 'test-org-id',
        displayName: 'Test Organization',
      },
    };
  }

  // ========== Test Helper Methods ==========

  /**
   * Seed with default test data
   */
  private seedTestData(): void {
    this.identities = [
      {
        id: 'user-1',
        userPrincipalName: 'user1@test.com',
        displayName: 'Test User 1',
        mail: 'user1@test.com',
        accountEnabled: true,
        signInActivity: {
          lastSignInDateTime: new Date().toISOString(),
        },
        assignedLicenses: [],
      },
      {
        id: 'user-2',
        userPrincipalName: 'user2@test.com',
        displayName: 'Test User 2',
        mail: 'user2@test.com',
        accountEnabled: true,
        signInActivity: {
          lastSignInDateTime: new Date().toISOString(),
        },
        assignedLicenses: [],
      },
    ];

    this.groups = [
      {
        id: 'group-1',
        displayName: 'Test Group 1',
        mailNickname: 'testgroup1',
      },
    ];

    this.roles = [
      {
        id: 'role-1',
        displayName: 'Global Administrator',
        description: 'Can manage all aspects of Azure AD',
      },
    ];

    this.policies = [];
    this.licenses = [];
  }

  /**
   * Set identities for testing
   */
  setIdentities(identities: MockMSGraphUser[]): void {
    this.identities = identities;
  }

  /**
   * Set groups for testing
   */
  setGroups(groups: MockMSGraphGroup[]): void {
    this.groups = groups;
  }

  /**
   * Set roles for testing
   */
  setRoles(roles: MockMSGraphRole[]): void {
    this.roles = roles;
  }

  /**
   * Set policies for testing
   */
  setPolicies(policies: MockMSGraphPolicy[]): void {
    this.policies = policies;
  }

  /**
   * Set licenses for testing
   */
  setLicenses(licenses: MockMSGraphSubscribedSku[]): void {
    this.licenses = licenses;
  }

  /**
   * Set page size for pagination testing
   */
  setPageSize(size: number): void {
    this.pageSize = size;
  }

  /**
   * Reset to default test data
   */
  reset(): void {
    this.seedTestData();
    this.pageSize = 100;
  }
}

/**
 * Create a new mock connector instance
 */
export function createMockMicrosoft365Connector(): MockMicrosoft365Connector {
  return new MockMicrosoft365Connector();
}
