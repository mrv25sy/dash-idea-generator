import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The VICE store (accounts, products, orders, settings, images) lives in the
// owner's original database, not the project's newer Cloud backend.
// These are public (publishable) values, safe to ship to the browser.
const STORE_URL = "https://aubowbcxajqtoiqufwgd.supabase.co";
const STORE_KEY = "sb_publishable_NVn37g73SnjdluR_tfadUw_IPVmAdHs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient<any, "public", any> = createClient(STORE_URL, STORE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
  },
});
