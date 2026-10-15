import { useEffect, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { supabase } from "@/lib/store-client";
import { storeClient } from "@/lib/store-client";

// Signed-in user's favorites, loaded once and shared by every heart.
let favs = new Set<string>();
let userId: string | null = null;
let started = false;
let version = 0;
const subs = new Set<() => void>();
const emit = () => { version++; subs.forEach((f) => f()); };

async function refresh() {
  const { data: s } = await supabase.auth.getSession();
  userId = s.session?.user.id ?? null;
  if (!userId) favs = new Set();
  else {
    const { data } = await storeClient.from("product_favorites").select("product_id").eq("user_id", userId);
    favs = new Set((data ?? []).map((r) => r.product_id));
  }
  emit();
}
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void refresh();
  supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN" || e === "SIGNED_OUT") void refresh(); });
}
export function useFavorites() {
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version, () => 0);
  useEffect(start, []);
  return { ids: favs, userId };
}

export function FavoriteButton({ productId, className = "" }: { productId: string; className?: string }) {
  const { ids } = useFavorites();
  const [msg, setMsg] = useState<"" | "signin" | "error">("");
  const on = ids.has(productId);
  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!userId) { setMsg("signin"); setTimeout(() => setMsg(""), 4000); return; }
    setMsg("");
    const { error } = on
      ? await storeClient.from("product_favorites").delete().eq("user_id", userId).eq("product_id", productId)
      : await storeClient.from("product_favorites").insert({ user_id: userId, product_id: productId });
    if (error) { setMsg("error"); return; }
    if (on) favs.delete(productId); else favs.add(productId);
    favs = new Set(favs); emit();
  };
  return (
    <div className={`relative ${className}`}>
      <button type="button" onClick={toggle} aria-pressed={on} aria-label={on ? "Remove from favourites" : "Add to favourites"}
        className={`grid h-9 w-9 place-items-center rounded-full border border-border bg-background/70 backdrop-blur transition hover:scale-110 ${on ? "text-primary" : "text-foreground"}`}>
        <Heart size={16} fill={on ? "currentColor" : "none"} strokeWidth={1.8} />
      </button>
      {msg && (
        <p className="absolute right-0 top-11 z-10 w-[8.5rem] border border-border bg-background p-2 text-[11px] leading-snug text-muted-foreground shadow-md">
          {msg === "signin" ? <><Link to="/account" className="text-primary underline">Sign up or sign in</Link> to save favourites.</> : "Couldn't save. Try again."}
        </p>
      )}
    </div>
  );
}
