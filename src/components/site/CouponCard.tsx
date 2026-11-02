import { useEffect, useState } from "react";
import { storeClient } from "@/lib/store-client";
import type { Coupon } from "@/lib/coupons";

let cache: Promise<Coupon[]> | null = null;
const loadCoupons = () =>
  (cache ??= Promise.resolve(
    storeClient.from("store_settings").select("value").eq("key", "coupons_json").maybeSingle(),
  ).then(({ data }) => {
    try { return data?.value ? (JSON.parse(data.value) as Coupon[]) : []; } catch { return []; }
  }));

/** Big, easy-to-copy coupon ticket shown inside inbox messages. */
export function CouponCard({ code }: { code: string }) {
  const [c, setC] = useState<Coupon | undefined>();
  const [copied, setCopied] = useState(false);
  useEffect(() => { void loadCoupons().then((all) => setC(all.find((x) => x.code.toUpperCase() === code.toUpperCase()))); }, [code]);
  const copy = () => { void navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const info: string[] = [];
  if (c?.minSpend) info.push(`Min spend $${c.minSpend}`);
  if (c?.minItems) info.push(`Min ${c.minItems} items`);
  if (c?.categories?.length) info.push(`On: ${c.categories.join(", ")}`);
  if (c?.oncePerCustomer) info.push("One use per customer");
  if (c?.startsAt) info.push(`From ${fmt(c.startsAt)}`);
  if (c?.endsAt) info.push(`Ends ${fmt(c.endsAt)}`);
  return (
    <div className="mt-3 overflow-hidden rounded-lg border-2 border-dashed border-primary bg-primary/10">
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
            {c ? (c.type === "percent" ? `${c.value}% OFF` : `$${c.value} OFF`) : "Coupon"}
          </p>
          <button onClick={copy} className="block truncate font-mono text-xl font-bold tracking-wider text-foreground">{code}</button>
        </div>
        <button onClick={copy} className="btn btn-primary h-10 shrink-0 px-4 text-[11px]">{copied ? "Copied ✓" : "Copy code"}</button>
      </div>
      {(info.length > 0 || (c && !c.active)) && (
        <div className="flex flex-wrap gap-1.5 border-t border-dashed border-primary/50 px-3 py-2">
          {c && !c.active && <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] text-destructive-foreground">No longer active</span>}
          {info.map((i) => <span key={i} className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">{i}</span>)}
        </div>
      )}
      <p className="px-3 pb-2 text-[10px] text-muted-foreground">Paste it in the coupon box at checkout.</p>
    </div>
  );
}
