'use server';

import { HaloPSAConnector } from "@workspace/shared/lib/connectors/HaloPSAConnector";
import Encryption from "@workspace/shared/lib/Encryption";
import type { HaloPSAConfig } from '@workspace/shared/types/integrations/halopsa';
import { client } from "@workspace/shared/lib/convex";
import { api } from "@/lib/api";

export async function testConnection(config: HaloPSAConfig) {
    try {
        if (!config.clientSecret.includes(':')) {
            config.clientSecret = await Encryption.encrypt(config.clientSecret, process.env.ENCRYPTION_KEY!);
        }

        const connector = new HaloPSAConnector(config, process.env.ENCRYPTION_KEY!);
        if (!connector) {
            return { data: false, error: 'Failed to create connector' };
        }

        const { error } = await connector.checkHealth();

        if (error) {
            return { data: false, error };
        }

        return { data: true };
    } catch (error: unknown) {
        return { data: false, error: error };
    }
}

export async function encryptSensitiveConfig(config: HaloPSAConfig) {
    try {
        // Fetch integration to get configSchema
        const integration = await client.query(api.integrations.query_s.getBySlug, {
            slug: 'halopsa',
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
