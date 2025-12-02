'use server';

import Encryption from "@workspace/shared/lib/Encryption";
import type { DattoRMMConfig } from '@workspace/shared/types/integrations/dattormm';
import { client } from "@workspace/shared/lib/convex";
import { api } from "@/lib/api";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel";

export async function testConnection(config: DattoRMMConfig) {
    try {
        // Decrypt API credentials
        const apiKey = config.apiKey.includes(':')
            ? await Encryption.decrypt(config.apiKey, process.env.ENCRYPTION_KEY!)
            : config.apiKey;

        const apiSecretKey = config.apiSecretKey.includes(':')
            ? await Encryption.decrypt(config.apiSecretKey, process.env.ENCRYPTION_KEY!)
            : config.apiSecretKey;

        if (!apiKey || !apiSecretKey) {
            return { data: false, error: 'Failed to decrypt API credentials' };
        }

        const response = await fetch(`${config.url}/auth/oauth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                'Authorization': 'Basic ' + Buffer.from('public-client:public').toString('base64')
            },
            body: new URLSearchParams({
                grant_type: "password",
                username: apiKey,
                password: apiSecretKey,
            }),
        });

        if (!response.ok) {
            return { data: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }

        return { data: true };
    } catch (error: unknown) {
        return { data: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function encryptSensitiveConfig(config: DattoRMMConfig) {
    try {
        // Fetch integration to get configSchema
        const integration = await client.query(api.integrations.query_s.getBySlug, {
            slug: 'datto-rmm',
            secret: process.env.CONVEX_API_KEY!
        });

        if (!integration) {
            return { data: null, error: 'Integration not found' };
        }

        const configSchema = integration.configSchema as Record<string, { sensitive?: boolean }>;
        const processedConfig: Record<string, any> = {};

        // Encrypt sensitive fields based on configSchema
        for (const [key, value] of Object.entries(config)) {
            if (!configSchema[key]) {
                processedConfig[key] = value;
                continue;
            }

            if (configSchema[key]?.sensitive && value) {
                // Only encrypt if value doesn't already contain ':' (already encrypted check)
                if (typeof value === 'string' && !value.includes(':')) {
                    processedConfig[key] = await Encryption.encrypt(value, process.env.ENCRYPTION_KEY!);
                } else {
                    processedConfig[key] = value;
                }
            } else if (value) {
                processedConfig[key] = value;
            }
        }

        return { data: processedConfig, error: null };
    } catch (error: unknown) {
        return { data: null, error: error instanceof Error ? error.message : 'Failed to encrypt configuration' };
    }
}

/**
 * Push MSPByte site ID to Datto RMM Site Variable
 * This is called by the UI after linkToRMMSite mutation succeeds
 */
export async function pushSiteVariable(
    dataSourceId: Id<"data_sources">,
    siteId: Id<"sites">,
    rmmSiteId: string
) {
    try {
        // Fetch data source config
        const dataSource = await client.query(api.helpers.orm.get_s, {
            tableName: "data_sources",
            id: dataSourceId,
            secret: process.env.CONVEX_API_KEY!
        }) as Doc<"data_sources">;

        if (!dataSource) {
            return { data: false, error: 'Data source not found' };
        }

        const config = dataSource.config as DattoRMMConfig;
        const variableName = config.siteVariableName || 'MSPSiteCode';

        // Decrypt API credentials
        const apiKey = config.apiKey
        const apiSecretKey = config.apiSecretKey.includes(':')
            ? await Encryption.decrypt(config.apiSecretKey, process.env.ENCRYPTION_KEY!)
            : config.apiSecretKey;

        if (!apiKey || !apiSecretKey) {
            return { data: false, error: 'Failed to decrypt API credentials' };
        }

        // Get OAuth token
        const tokenResponse = await fetch(`${config.url}/auth/oauth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                'Authorization': 'Basic ' + Buffer.from('public-client:public').toString('base64')
            },
            body: new URLSearchParams({
                grant_type: "password",
                username: apiKey,
                password: apiSecretKey,
            }),
        });

        if (!tokenResponse.ok) {
            return { data: false, error: `Failed to get token: HTTP ${tokenResponse.status}: ${tokenResponse.statusText}` };
        }

        const tokenData: { access_token: string } = await tokenResponse.json();
        const token = tokenData.access_token;

        // First, get all variables to find the variableId
        const variablesResponse = await fetch(
            `${config.url}/api/v2/site/${rmmSiteId}/variables`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            }
        );

        let variableId: string | null = null;

        if (variablesResponse.ok) {
            const data = await variablesResponse.json();
            const variables = data.variables;
            const matchingVariable = variables.find((v: any) => v.name === variableName);
            if (matchingVariable) {
                variableId = matchingVariable.id;
            }
        } else if (variablesResponse.status !== 404) {
            return { data: false, error: `Failed to fetch variables: HTTP ${variablesResponse.status}: ${variablesResponse.statusText}` };
        }

        // Push site variable to Datto RMM
        let response;
        if (variableId) {
            // Update existing variable using variableId
            response = await fetch(
                `${config.url}/api/v2/site/${rmmSiteId}/variable/${variableId}`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name: variableName,
                        value: siteId,
                    }),
                }
            );
        } else {
            // Create new variable (no variableId in path)
            response = await fetch(
                `${config.url}/api/v2/site/${rmmSiteId}/variable`,
                {
                    method: "PUT",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name: variableName,
                        value: siteId,
                    }),
                }
            );
        }

        if (!response.ok) {
            return { data: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }

        return { data: true, error: null };
    } catch (error: unknown) {
        return { data: false, error: error instanceof Error ? error.message : 'Failed to push site variable' };
    }
}
