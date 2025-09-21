import { createClient as _createClient } from "@supabase/supabase-js";
import { Database } from "@workspace/shared/types/database/import";

export const createPrivelagedClient = () => {
  return _createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_SUPABASE_PRIV_KEY!
  );
};
