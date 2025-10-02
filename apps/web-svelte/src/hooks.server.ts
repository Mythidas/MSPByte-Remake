import { createServerClient } from '$lib/database/client.js';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const supabaseHandle: Handle = async ({ event, resolve }) => {
	const supabase = createServerClient(event);
	const safeGetSession = async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) return { session: null, user: null };
		const {
			data: { user },
			error
		} = await supabase.auth.getUser();
		if (error) return { session: null, user: null }; // invalid JWT
		return { session, user };
	};

	event.locals.auth = { safeGetSession, supabase, session: null, user: null };
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

	const { session, user } = await event.locals.auth.safeGetSession();
	event.locals.auth.session = session;
	event.locals.auth.user = user;

	if (!session && event.url.pathname === '/') {
		throw redirect(303, '/public');
	}
	if (!session && event.url.pathname.startsWith('/private')) {
		throw redirect(303, '/auth/login');
	}

	return resolve(event);
};

export const handle = sequence(supabaseHandle, authGuard);
