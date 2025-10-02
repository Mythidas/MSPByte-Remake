import { createServerClient } from '$lib/database/client';
import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { PUBLIC_ORIGIN } from '$env/static/public';

export const actions = {
	azure: async (event) => {
		const supabase = createServerClient(event);
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: 'azure',
			options: {
				scopes: 'openid email profile offline_access',
				redirectTo: `${PUBLIC_ORIGIN}/auth/callback`
			}
		});

		if (error) {
			console.error('OAuth error:', error);
			return { error: error.message };
		}

		throw redirect(303, data.url);
	}
} satisfies Actions;
