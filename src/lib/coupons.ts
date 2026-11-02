// Coupons are a JSON list in store_settings (coupons_json); checkout validates them here.
export type Coupon = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  active: boolean;
  startsAt?: string; // ISO datetime, optional
  endsAt?: string;
  minItems?: number; // cart must contain at least this many pieces
  minSpend?: number;
  categories?: string[]; // empty = all; "bundle" counts bundles
  oncePerCustomer?: boolean; // needs sign-in
  customerIds?: number[]; // empty = everyone; set = only these signed-in customers
};

export type CouponLine = { category: string; qty: number; total: number };
export type CouponCtx = { now: Date; lines: CouponLine[]; customerId: number | null; usedCodes: string[] };

/** Numeric customer number for a signed-up account, e.g. 48213 (shown as #48213). */
export function customerNumber(uid: string): number {
  return (parseInt(uid.replace(/-/g, "").slice(0, 8), 16) % 90000) + 10000;
}
export const parseIds = (s: string) => [...new Set((s.match(/\d{5}/g) ?? []).map(Number))];

/** Returns { discount } or { error } in plain words. */
export function applyCoupon(c: Coupon | undefined, ctx: CouponCtx): { discount: number; error?: undefined } | { error: string; discount?: undefined } {
  if (!c || !c.active) return { error: "This code doesn't exist." };
  const t = ctx.now.getTime();
  if (c.startsAt && t < new Date(c.startsAt).getTime()) return { error: "This code isn't active yet." };
  if (c.endsAt && t > new Date(c.endsAt).getTime()) return { error: "This code has expired." };
  if ((c.oncePerCustomer || c.customerIds?.length) && ctx.customerId == null) return { error: "Sign in to use this code." };
  if (c.customerIds?.length && !c.customerIds.includes(ctx.customerId!)) return { error: "This code isn't for your account." };
  if (c.oncePerCustomer && ctx.usedCodes.map((x) => x.toUpperCase()).includes(c.code.toUpperCase())) return { error: "You already used this code." };
  const eligible = c.categories?.length ? ctx.lines.filter((l) => c.categories!.includes(l.category)) : ctx.lines;
  const items = eligible.reduce((a, l) => a + l.qty, 0);
  const base = eligible.reduce((a, l) => a + l.total, 0);
  if (!items) return { error: "None of your items can use this code." };
  if (c.minItems && items < c.minItems) return { error: `Add at least ${c.minItems} eligible items to use this code.` };
  const all = ctx.lines.reduce((a, l) => a + l.total, 0);
  if (c.minSpend && all < c.minSpend) return { error: `Spend at least ${c.minSpend} to use this code.` };
  const d = c.type === "percent" ? Math.round((base * Math.min(100, c.value)) / 100) : Math.min(base, c.value);
  return { discount: Math.max(0, d) };
}

/** Messages can target customers: tag stored as "Offer|to:12345,67890|coupon:CODE". */
export function packTag(tag: string, to: number[], coupon: string) {
  return [tag, to.length ? `to:${to.join(",")}` : "", coupon ? `coupon:${coupon}` : ""].filter(Boolean).join("|") || null;
}
export function unpackTag(raw: string | null) {
  const parts = (raw ?? "").split("|");
  let tag = "", coupon = "", to: number[] = [];
  for (const p of parts) {
    if (p.startsWith("to:")) to = parseIds(p.slice(3));
    else if (p.startsWith("coupon:")) coupon = p.slice(7);
    else if (p) tag = p;
  }
  return { tag, to, coupon };
}
