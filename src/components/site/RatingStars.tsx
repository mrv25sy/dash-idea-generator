import { useEffect, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { storeClient } from "@/lib/store-client";

// All ratings are loaded once and shared by every star widget on the page.
type Row = { product_id: string; user_id: string; stars: number };
let rows: Row[] = [];
let userId: string | null = null;
let started = false;
let version = 0;
const subs = new Set<() => void>();
const emit = () => { version++; subs.forEach((f) => f()); };

async function refresh() {
  const [{ data: s }, { data }] = await Promise.all([
    supabase.auth.getSession(),
    storeClient.from("product_ratings").select("product_id,user_id,stars"),
  ]);
  userId = s.session?.user.id ?? null;
  rows = data ?? [];
  emit();
}
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  refresh();
  supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN" || e === "SIGNED_OUT") refresh(); });
}
const useRatings = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version, () => 0);

export function RatingStars({ productId, compact = false }: { productId: string; compact?: boolean }) {
  useRatings();
  useEffect(start, []);
  const [hover, setHover] = useState(0);
  const [msg, setMsg] = useState<"signin" | "error" | "">("");
  const mine = rows.filter((r) => r.product_id === productId);
  const avg = mine.length ? mine.reduce((s, r) => s + r.stars, 0) / mine.length : 0;
  const own = userId ? mine.find((r) => r.user_id === userId)?.stars ?? 0 : 0;
  const shown = hover || own || Math.round(avg);

  const rate = async (stars: number) => {
    if (!userId) { setMsg("signin"); return; }
    setMsg("");
    const { error } = await storeClient.from("product_ratings").upsert({ product_id: productId, user_id: userId, stars }, { onConflict: "product_id,user_id" });
    if (error) { setMsg("error"); return; }
    await refresh();
  };

  const size = compact ? 13 : 20;
  return (
    <div className="text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <div className="stars" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rate this product">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={own === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onMouseEnter={() => setHover(n)} onClick={() => rate(n)} className={n <= shown ? "on" : ""}>
              <Star size={size} fill={n <= shown ? "currentColor" : "none"} strokeWidth={1.6} />
            </button>
          ))}
        </div>
        <span>{mine.length ? `${avg.toFixed(1)} (${mine.length})` : compact ? "" : "No ratings yet"}</span>
      </div>
      {!compact && own > 0 && <p className="mt-1">You rated this {own}/5</p>}
      {msg === "signin" && <p className="mt-1 text-primary"><Link to="/account" className="underline">Sign up or sign in</Link> to rate.</p>}
      {msg === "error" && <p className="mt-1 text-primary">Couldn't save your rating. Try again.</p>}
    </div>
  );
}
