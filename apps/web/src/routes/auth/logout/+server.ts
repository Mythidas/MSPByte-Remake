import { redirect, type RequestHandler } from '@sveltejs/kit';
import { authKit } from '@workos/authkit-sveltekit';

export const GET: RequestHandler = async (event) => {
	await authKit.signOut(event);
	return redirect(307, '/');
};
