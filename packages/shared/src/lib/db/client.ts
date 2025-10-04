import { createClient as _createClient } from "@supabase/supabase-js";
import { Database } from "@workspace/shared/types/database/import.js";

// Singleton instance to prevent memory leaks from creating multiple clients
let _privilegedClient: ReturnType<typeof _createClient<Database>> | null = null;

export const createPrivelagedClient = () => {
  if (!_privilegedClient) {
    _privilegedClient = _createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_SUPABASE_API_KEY!
    );
  }
  return _privilegedClient;
};
