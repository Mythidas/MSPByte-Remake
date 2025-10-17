import {
	WORKOS_CLIENT_ID,
	WORKOS_API_KEY,
	WORKOS_REDIRECT_URI,
	WORKOS_COOKIE_PASSWORD
} from '$env/static/private';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { authKitHandle, configureAuthKit } from '@workos/authkit-sveltekit';
import { ConvexHttpClient } from 'convex/browser';

configureAuthKit({
	clientId: WORKOS_CLIENT_ID,
	apiKey: WORKOS_API_KEY,
	redirectUri: WORKOS_REDIRECT_URI,
	cookiePassword: WORKOS_COOKIE_PASSWORD
});

const convexHandle: Handle = async ({ event, resolve }) => {
	const token = event.locals.auth?.accessToken;
	event.locals.client = new ConvexHttpClient(PUBLIC_CONVEX_URL, {
		auth: token || undefined
	});

	return resolve(event);
};

export const handle = sequence(authKitHandle(), convexHandle);
