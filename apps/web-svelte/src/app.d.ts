import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database } from '@workspace/shared/types/database/import';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			auth: {
				supabase: SupabaseClient<Database>;
				safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
				session: Session | null;
				user: User | null;
			};
		}
		interface PageData {
			session: Session | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
