"use client";

import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@workspace/shared/types/database/import";

export const createClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};