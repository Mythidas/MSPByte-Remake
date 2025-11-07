import { CONVEX_API_KEY, MICROSOFT_SECRET } from '$env/static/private';
import { PUBLIC_MICROSOFT_CLIENT_ID } from '$env/static/public';
import { api } from '$lib/convex/index.js';
import type { M365ConsentCallback } from '$lib/types/callbacks.js';
import { redirect, type RequestHandler } from '@sveltejs/kit';
import type { Microsoft365DataSourceConfig } from '@workspace/shared/types/integrations/microsoft-365/index.js';

type TenantInfo = {
    id: string;
    displayName: string;
    verifiedDomains: Array<{
        name: string;
        isDefault: boolean;
    }>;
};

export const GET: RequestHandler = async ({ locals, url }) => {
    const { searchParams } = url;
    const redUrl = '/integrations/microsoft-365';

    const adminConsent = searchParams.get('admin_consent');
    const tenantId = searchParams.get('tenant');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
        console.error('Microsoft 365 consent error: ', error, errorDescription);
        redirect(307, `${redUrl}?error=${encodeURIComponent('Failed to gain admin consent')}`);
    }

    if (!adminConsent || !tenantId || !state) {
        redirect(307, `${redUrl}?error=${encodeURIComponent('Missing required parameters')}`);
    }

    if (adminConsent !== 'True') {
        redirect(307, `${redUrl}?error=${encodeURIComponent('Admin consent was denied')}`);
    }

    try {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const stateData: M365ConsentCallback = JSON.parse(state);
        const tokenResponse = await fetch(
            `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: PUBLIC_MICROSOFT_CLIENT_ID,
                    client_secret: MICROSOFT_SECRET,
                    scope: 'https://graph.microsoft.com/.default',
                    grant_type: 'client_credentials'
                })
            }
        );

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            throw new Error(`Token request failed: ${errorData.error_description || errorData.error}`);
        }

        const tokenData = await tokenResponse.json();

        // Get tenant information using the access token
        const tenantInfoResponse = await fetch('https://graph.microsoft.com/v1.0/organization', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!tenantInfoResponse.ok) {
            throw new Error(`Failed to get tenant info: ${tenantInfoResponse.statusText}`);
        }

        const tenantInfoData = await tenantInfoResponse.json();
        const tenantInfo: TenantInfo = tenantInfoData.value[0];

        const integration = await locals.client.query(api.integrations.query_s.getBySlug, {
            slug: 'microsoft-365',
            secret: CONVEX_API_KEY
        });
        if (!integration) throw new Error('Integration not found');

        const currentRevision = (integration.configSchema.permissionVerison as number) || 0;

        const dataSource = await locals.client.mutation(api.helpers.orm.insert_s, {
            tableName: "data_sources",
            secret: CONVEX_API_KEY,
            tenantId: stateData.tenantId as any,
            data: [{
                externalId: tenantId,
                status: 'active',
                integrationId: integration._id,
                isPrimary: false,
                config: {
                    name: stateData.name,
                    tenantId: tenantInfo.id,
                    tenantName: tenantInfo.displayName,
                    permissionsVersion: currentRevision,
                    availableDomains: tenantInfo.verifiedDomains.map((d) => ({
                        name: d.name,
                        isDefault: d.isDefault,
                        userCount: 0
                    }))
                } as Microsoft365DataSourceConfig,
                credentialExpirationAt: Number.MAX_SAFE_INTEGER
            }]
        });
        if (!dataSource) throw 'Failed to create data source';

        await locals.client.mutation(api.helpers.orm.update_s, {
            tableName: 'data_sources',
            secret: CONVEX_API_KEY,
            data: [{ id: stateData.dataSourceId as any, updates: { config: { permissionVersion: 0 } } }]
        })

        redirect(308, `${redUrl}?success=true&tenant=${encodeURIComponent(tenantInfo.displayName)}`);
    } catch (error) {
        console.log(error);
        redirect(307, `${redUrl}?error=${encodeURIComponent(error as string)}`);
    }
};
