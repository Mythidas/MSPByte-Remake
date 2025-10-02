import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			auth: {
				supabase: SupabaseClient;
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
