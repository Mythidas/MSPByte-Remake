import { createServerClient } from '$lib/database/client';
import type { RequestEvent } from '@sveltejs/kit';
import type { Filters } from '@workspace/shared/types/database';

export async function fetchUsers(
	event: RequestEvent<Record<string, never>>,
	options: {
		page: number;
		pageSize: number;
		search?: string;
		filters?: Filters;
		sorts?: Record<string, 'asc' | 'desc'>;
	}
) {
	const { page, pageSize, search, filters = {}, sorts = {} } = options;

	const supabase = createServerClient(event);

	// Start query
	let query = supabase.from('users_view').select('*', { count: 'exact' });

	// Apply global search
	if (search) {
		query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
	}

	// Apply filters
	for (const [key, filterValue] of Object.entries(filters)) {
		if (filterValue && typeof filterValue === 'object' && 'op' in filterValue) {
			const fv = filterValue as any;
			if (fv.value !== undefined && fv.value !== null && fv.value !== '') {
				const op = fv.op.replace('not.', '');
				const isNot = fv.op.startsWith('not.');

				switch (op) {
					case 'eq':
						query = isNot ? query.neq(key, fv.value) : query.eq(key, fv.value);
						break;
					case 'ilike':
						query = isNot
							? query.not(key, 'ilike', `%${fv.value}%`)
							: query.ilike(key, `%${fv.value}%`);
						break;
					case 'gte':
						query = query.gte(key, fv.value);
						break;
					case 'lte':
						query = query.lte(key, fv.value);
						break;
					case 'gt':
						query = query.gt(key, fv.value);
						break;
					case 'lt':
						query = query.lt(key, fv.value);
						break;
					case 'in':
						query = isNot ? query.not(key, 'in', fv.value) : query.in(key, fv.value);
						break;
					default:
						query = query.eq(key, fv.value);
				}
			}
		}
	}

	// Apply sorts
	for (const [key, direction] of Object.entries(sorts)) {
		query = query.order(key, { ascending: direction === 'asc' });
	}

	// If no sorts, default to created_at desc
	if (Object.keys(sorts).length === 0) {
		query = query.order('created_at', { ascending: false });
	}

	// Apply pagination
	const from = (page - 1) * pageSize;
	const to = from + pageSize - 1;
	query = query.range(from, to);

	const { data, error, count } = await query;

	if (error) {
		throw error;
	}

	return {
		data: data || [],
		total: count || 0,
		page,
		pageSize
	};
}
