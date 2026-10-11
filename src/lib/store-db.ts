import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as typed } from "@/integrations/supabase/client";

// Store tables (products, orders, profiles, store_settings…) are not yet in the
// generated types, so store code uses an untyped view of the same client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = typed as unknown as SupabaseClient<any, "public", any>;
