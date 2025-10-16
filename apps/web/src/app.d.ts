/// <reference types="@sveltejs/kit" />

import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database } from '@workspace/shared/types/database/import';
import type { Tables } from '@workspace/shared/types/database/index.js';
import type { ConvexHttpClient } from 'convex/browser';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			client: ConvexHttpClient;
			auth: import('@workos/authkit-sveltekit').AuthKitAuth;
		}
		// interface PageData {};
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
