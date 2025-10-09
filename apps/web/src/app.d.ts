/// <reference types="svelte-clerk/env" />

import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database } from '@workspace/shared/types/database/import';
import type { Tables } from '@workspace/shared/types/database/index.js';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {};
		// interface PageData {};
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
