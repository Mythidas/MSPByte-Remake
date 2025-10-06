import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database } from '@workspace/shared/types/database/import';
import type { Tables } from '@workspace/shared/types/database/index.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			auth: {
				supabase: SupabaseClient<Database>;
				user: Tables<'users_view'> | null;
			};
		}
		// interface PageData {};
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
