import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';

const clerkHandle = withClerkHandler();

const authGuard: Handle = async ({ event, resolve }) => {
	// Skip auth guard for auth routes - let them handle authentication
	if (event.url.pathname.startsWith('/auth')) {
		return resolve(event);
	}

	const user = event.locals.auth();

	if (!user.isAuthenticated && event.url.pathname === '/') {
		throw redirect(303, '/public');
	}
	if (!user.isAuthenticated && !event.url.pathname.startsWith('/auth')) {
		throw redirect(303, '/auth/login');
	}

	return resolve(event);
};

export const handle = sequence(clerkHandle, authGuard);
