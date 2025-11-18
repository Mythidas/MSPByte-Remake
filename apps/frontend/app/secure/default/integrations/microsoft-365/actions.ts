'use server';

import { client } from "@workspace/shared/lib/convex";
import { api } from "@/lib/api";
import type { M365ConsentState } from "@workspace/shared/types/integrations/microsoft-365";
import type { Id } from "@workspace/database/convex/_generated/dataModel";

/**
 * Generate Microsoft Admin Consent URL
 * This redirects users to Microsoft's admin consent flow
 */
export async function generateConsentUrl(params: {
    tenantId: string;
    dataSourceId: string;
    connectionName: string;
}) {
    try {
        const state: M365ConsentState = {
            action: 'initial',
            tenantId: params.tenantId,
            dataSourceId: params.dataSourceId,
            name: params.connectionName,
            timestamp: Date.now(),
        };

        const callbackUrl = `${process.env.NEXT_PUBLIC_ORIGIN}/api/v1.0/callbacks/microsoft-365/consent`;

        const consentUrl = new URL('https://login.microsoftonline.com/common/adminconsent');
        consentUrl.searchParams.set('client_id', process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!);
        consentUrl.searchParams.set('redirect_uri', callbackUrl);
        consentUrl.searchParams.set('state', JSON.stringify(state));

        return { data: consentUrl.toString(), error: null };
    } catch (error: unknown) {
        return {
            data: null,
            error: error instanceof Error ? error.message : 'Failed to generate consent URL'
        };
    }
}

/**
 * Enable the Microsoft 365 integration
 * Creates the primary data source with minimal config
 */
export async function enableIntegration() {
    try {
        // Get the M365 integration
        const integration = await client.query(api.integrations.query_s.getBySlug, {
            slug: 'microsoft-365',
            secret: process.env.CONVEX_API_KEY!
        });

        if (!integration) {
            return { data: null, error: 'Microsoft 365 integration not found' };
        }

        // Create primary data source (createOrUpdate always creates/updates primary)
        const dataSource = await client.mutation(api.datasources.mutate.createOrUpdate, {
            integrationId: integration._id,
            config: { permissionVersion: 0 },
            credentialExpirationAt: Number.MAX_SAFE_INTEGER,
        });

        return { data: dataSource, error: null };
    } catch (error: unknown) {
        return {
            data: null,
            error: error instanceof Error ? error.message : 'Failed to enable integration'
        };
    }
}

/**
 * Check if the integration is already enabled
 */
export async function getIntegrationStatus() {
    try {
        const integration = await client.query(api.integrations.query_s.getBySlug, {
            slug: 'microsoft-365',
            secret: process.env.CONVEX_API_KEY!
        });

        if (!integration) {
            return { data: null, error: 'Integration not found' };
        }

        // Check if primary data source exists
        const dataSources = await client.query(api.helpers.orm.list_s, {
            tableName: 'data_sources',
            secret: process.env.CONVEX_API_KEY!,
            filters: {
                integrationId: integration._id,
                isPrimary: true,
            },
        });

        const isEnabled = dataSources && dataSources.length > 0;
        const primaryDataSource = isEnabled ? dataSources[0] : null;

        return {
            data: {
                isEnabled,
                integration,
                primaryDataSource,
            },
            error: null
        };
    } catch (error: unknown) {
        return {
            data: null,
            error: error instanceof Error ? error.message : 'Failed to check integration status'
        };
    }
}

/**
 * Update connection name
 */
export async function updateConnectionName(params: {
    dataSourceId: string;
    newName: string;
}) {
    try {
        // Get current data source to preserve other config
        const dataSource = await client.query(api.helpers.orm.get_s, {
            tableName: 'data_sources',
            secret: process.env.CONVEX_API_KEY!,
            id: params.dataSourceId as Id<'data_sources'>,
        }) as any;

        if (!dataSource) {
            return { data: null, error: 'Connection not found' };
        }

        // Update the name in config
        const updatedConfig = {
            ...dataSource.config,
            name: params.newName.trim(),
        };

        await client.mutation(api.helpers.orm.update_s, {
            tableName: 'data_sources',
            secret: process.env.CONVEX_API_KEY!,
            data: [{
                id: params.dataSourceId as Id<'data_sources'>,
                updates: { config: updatedConfig }
            }]
        });

        return { data: true, error: null };
    } catch (error: unknown) {
        return {
            data: null,
            error: error instanceof Error ? error.message : 'Failed to update connection name'
        };
    }
}

/**
 * Delete (soft delete) a connection
 */
export async function deleteConnection(dataSourceId: string) {
    try {
        await client.mutation(api.helpers.orm.update_s, {
            tableName: 'data_sources',
            secret: process.env.CONVEX_API_KEY!,
            data: [{
                id: dataSourceId as Id<'data_sources'>,
                updates: {
                    deletedAt: Date.now(),
                    status: 'inactive' as const
                }
            }]
        });

        return { data: true, error: null };
    } catch (error: unknown) {
        return {
            data: null,
            error: error instanceof Error ? error.message : 'Failed to delete connection'
        };
    }
}

/**
 * Check if connection needs reconsent based on permission version
 */
export async function checkPermissionVersion(params: {
    dataSourceId: string;
}) {
    try {
        const integration = await client.query(api.integrations.query_s.getBySlug, {
            slug: 'microsoft-365',
            secret: process.env.CONVEX_API_KEY!
        });

        if (!integration) {
            return { data: null, error: 'Integration not found' };
        }

        const dataSource = await client.query(api.helpers.orm.get_s, {
            tableName: 'data_sources',
            secret: process.env.CONVEX_API_KEY!,
            id: params.dataSourceId as Id<'data_sources'>,
        }) as any;

        if (!dataSource) {
            return { data: null, error: 'Connection not found' };
        }

        const currentVersion = (integration.configSchema?.permissionVersion as number) || 0;
        const connectionVersion = (dataSource.config as any).permissionVersion || 0;

        return {
            data: {
                needsReconsent: connectionVersion < currentVersion,
                currentVersion,
                connectionVersion
            },
            error: null
        };
    } catch (error: unknown) {
        return {
            data: null,
            error: error instanceof Error ? error.message : 'Failed to check permission version'
        };
    }
}
