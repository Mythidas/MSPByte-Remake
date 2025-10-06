import { createServerClient } from '$lib/database/client';
import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent) {
	const code = event.url.searchParams.get('code');
	const redirectTo = event.url.searchParams.get('redirect_to');

	if (code) {
		const supabase = createServerClient(event);
		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (error) {
			console.error('Error exchanging code for session:', error);
			throw redirect(303, '/auth/login?error=auth_callback_failed');
		}
	}

	throw redirect(303, redirectTo ?? '/');
}
