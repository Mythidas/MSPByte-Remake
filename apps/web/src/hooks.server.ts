import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { ConvexHttpClient } from 'convex/browser';
import { withClerkHandler } from 'svelte-clerk/server';

const clerkHandle = withClerkHandler();

const convexHandle: Handle = async ({ event, resolve }) => {
	try {
		const auth = event.locals.auth();
		const token = await auth.getToken({ template: 'convex' });

		event.locals.token = token || undefined;
		event.locals.client = new ConvexHttpClient(PUBLIC_CONVEX_URL, {
			auth: token || undefined
		});
	} catch {
		event.locals.client = new ConvexHttpClient(PUBLIC_CONVEX_URL);
	} finally {
		return resolve(event);
	}
};

const authGuard: Handle = async ({ event, resolve }) => {
	// Skip auth guard for auth routes - let them handle authentication
	if (event.url.pathname.startsWith('/auth')) {
		return resolve(event);
	}

	const user = event.locals.auth();

	if (event.url.pathname === '/') {
		if (user.isAuthenticated) {
			throw redirect(303, '/s');
		} else return resolve(event);
	}

	if (!user.isAuthenticated && !event.url.pathname.startsWith('/auth')) {
		throw redirect(303, '/auth/login');
	}

	return resolve(event);
};

export const handle = sequence(clerkHandle, convexHandle, authGuard);
