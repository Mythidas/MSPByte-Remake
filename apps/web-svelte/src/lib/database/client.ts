import { createClient as _createClient } from '@supabase/supabase-js';
import { createServerClient as _createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { RequestEvent } from '@sveltejs/kit';

export const createClient = () => {
	return _createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
};

export const createServerClient = (event: RequestEvent<Record<string, never>>) => {
	return _createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) =>
				cookies.forEach(({ name, value, options }) =>
					event.cookies.set(name, value, { ...options, path: '/' })
				)
		}
	});
};
