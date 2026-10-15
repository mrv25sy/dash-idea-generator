import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// The checked-in 0006 migration extends the store schema beyond the generated
// snapshot. Keep that extension typed without editing generated files or
// creating a second client/session. Remove it once that snapshot is refreshed.
type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  governorate: string | null;
  address: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};
type SettingsRow = { key: string; value: string; updated_at: string };
export type BroadcastRow = { id: string; title: string; body: string; tag: string | null; created_at: string };
type GeneratedOrders = Database["public"]["Tables"]["orders"];

export type StoreDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "orders"> & {
      orders: Omit<GeneratedOrders, "Row" | "Insert" | "Update"> & {
        Row: GeneratedOrders["Row"] & { user_id: string | null };
        Insert: GeneratedOrders["Insert"] & { user_id?: string | null };
        Update: GeneratedOrders["Update"] & { user_id?: string | null };
      };
      profiles: {
        Row: ProfileRow;
        Insert: Pick<ProfileRow, "id"> & Partial<Omit<ProfileRow, "id">>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      product_ratings: {
        Row: { product_id: string; user_id: string; stars: number; created_at: string; updated_at: string };
        Insert: { product_id: string; user_id: string; stars: number };
        Update: { stars?: number };
        Relationships: [];
      };
      product_favorites: {
        Row: { user_id: string; product_id: string; created_at: string };
        Insert: { user_id: string; product_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      broadcast_messages: {
        Row: BroadcastRow;
        Insert: { title: string; body: string; tag?: string | null };
        Update: Partial<BroadcastRow>;
        Relationships: [];
      };
      store_settings: {
        Row: SettingsRow;
        Insert: Pick<SettingsRow, "key" | "value"> & Partial<Pick<SettingsRow, "updated_at">>;
        Update: Partial<SettingsRow>;
        Relationships: [];
      };
    };
  };
};

export const storeClient = supabase as unknown as SupabaseClient<StoreDatabase>;