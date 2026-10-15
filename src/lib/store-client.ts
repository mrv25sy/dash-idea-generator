import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The live store (accounts, products, orders, favourites) lives in the owner's
// original database, not the newer Cloud instance. Publishable key is public by design.
const STORE_URL = "https://ffctvjfvsowxnikxjlxx.supabase.co";
const STORE_KEY = "sb_publishable_ULgbrDsaXPYVEC685ttTvw__tZFG9lY";

export type BroadcastRow = { id: string; title: string; body: string; tag: string | null; created_at: string };

const isBrowser = typeof window !== "undefined";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const storeClient: SupabaseClient<any, "public", any> = createClient(STORE_URL, STORE_KEY, {
  auth: {
    storage: isBrowser ? window.localStorage : undefined,
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
  },
});
// Auth + RPC on store pages share this same session.
export const supabase = storeClient;
