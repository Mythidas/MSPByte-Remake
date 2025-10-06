import { createServerClient } from '$lib/database/client.js';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const supabaseHandle: Handle = async ({ event, resolve }) => {
	const supabase = createServerClient(event as any);
	const safeGetSession = async () => {
		const { data } = await supabase.auth.getUser();
		if (!data) return { user: null };
		const { data: user, error } = await supabase
			.schema('views')
			.from('users_view')
			.select('*')
			.eq('id', data.user?.id || '')
			.single();
		if (error) return { user: null }; // invalid JWT
		return { user };
	};

	const { user } = await safeGetSession();

	event.locals.auth = { supabase, user };
	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

const authGuard: Handle = async ({ event, resolve }) => {
	// Skip auth guard for auth routes - let them handle authentication
	if (event.url.pathname.startsWith('/auth')) {
		return resolve(event);
	}

	const { user } = event.locals.auth;

	if (!user && event.url.pathname === '/') {
		throw redirect(303, '/public');
	}
	if (!user && event.url.pathname.startsWith('/private')) {
		throw redirect(303, '/auth/login');
	}

	return resolve(event);
};

export const handle = sequence(supabaseHandle, authGuard);
