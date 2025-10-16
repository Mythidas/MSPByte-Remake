import { PUBLIC_ORIGIN } from '$env/static/public';
import { redirect, type RequestHandler } from '@sveltejs/kit';
import { authKit } from '@workos/authkit-sveltekit';

export const GET: RequestHandler = async (event) => {
	const url = await authKit.getSignInUrl({
		returnTo: `${PUBLIC_ORIGIN}/api/v1.0/callbacks/workos`
	});
	return redirect(307, url);
};
