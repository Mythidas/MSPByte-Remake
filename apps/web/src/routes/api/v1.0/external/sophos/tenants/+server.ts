import { ORM } from '$lib/database/orm.js';
import { json, type RequestHandler } from '@sveltejs/kit';
import SophosPartnerConnector from '@workspace/shared/lib/connectors/SophosPartnerConnector.js';
import type { SophosPartnerConfig } from '@workspace/shared/types/integrations/sophos-partner/index.js';
import type { APIError } from '@workspace/shared/types/api.js';
import { ENCRYPTION_KEY } from '$env/static/private';

export const GET: RequestHandler = async ({ url, locals }) => {
	const dataSourceId = url.searchParams.get('dataSourceId');

	if (!dataSourceId) {
		return json(
			{
				error: {
					module: 'SophosAPI',
					context: 'GET /api/v1.0/external/sophos/tenants',
					message: 'dataSourceId query parameter is required',
					time: new Date().toISOString(),
					code: 'MISSING_PARAMETER'
				} as APIError
			},
			{ status: 400 }
		);
	}

	const orm = new ORM(locals.auth.supabase);
	const { data: dataSource } = await orm.getRow('data_sources', {
		filters: [['id', 'eq', dataSourceId]]
	});

	if (!dataSource) {
		return json(
			{
				error: {
					module: 'SophosAPI',
					context: 'GET /api/v1.0/external/sophos/tenants',
					message: 'Data source not found with provided dataSourceId',
					time: new Date().toISOString(),
					code: 'DATA_SOURCE_NOT_FOUND'
				} as APIError
			},
			{ status: 404 }
		);
	}

	const connector = new SophosPartnerConnector(
		dataSource.config as SophosPartnerConfig,
		ENCRYPTION_KEY
	);
	const { data: tenants, error: sophosError } = await connector.getTenants();

	if (sophosError) {
		return json(
			{
				error: sophosError
			},
			{ status: 500 }
		);
	}

	return json({
		data: tenants
	});
};
