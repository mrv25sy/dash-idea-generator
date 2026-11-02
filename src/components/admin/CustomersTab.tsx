import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/store-client";
import { products } from "@/data/products";
import { StatusBadge, normStatus } from "@/lib/order-status";
import { customerNumber } from "@/lib/coupons";

type Order = { id: string; order_code: string; name: string; phone: string; governorate: string; total: number; status: string; created_at: string; user_id: string | null; items: unknown };
type Profile = { id: string; full_name: string | null; phone: string | null; governorate: string | null; created_at: string };
type Rating = { product_id: string; user_id: string; stars: number };
export type Customer = { key: string; name: string; phone: string; governorate: string; orders: Order[]; spent: number; count: number; last: string; userIds: string[]; number: number | null };

/** Same customer = same phone number, ignoring spaces, +963 / 00963 / leading 0. */
export const phoneKey = (p: string) => {
  let d = (p || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("963")) d = d.slice(3);
  return d.replace(/^0+/, "");
};
const isCounted = (s: string) => !["Canceled", "Declined"].includes(normStatus(s));

/** Signed-up accounts (even with no orders) plus guests grouped by phone. */
export function groupCustomers(orders: Order[], profiles: Profile[] = []): Customer[] {
  const map = new Map<string, Customer>();
  const byUser = new Map<string, string>();
  for (const p of profiles) {
    const key = "u:" + p.id;
    byUser.set(p.id, key);
    map.set(key, { key, name: p.full_name || "No name", phone: p.phone || "", governorate: p.governorate || "", orders: [], spent: 0, count: 0, last: p.created_at, userIds: [p.id], number: customerNumber(p.id) });
    const pk = phoneKey(p.phone || "");
    if (pk) byUser.set("p:" + pk, key);
  }
  for (const o of orders) {
    const pk = phoneKey(o.phone);
    const key = (o.user_id && byUser.get(o.user_id)) || byUser.get("p:" + pk) || pk || o.name.trim().toLowerCase();
    const c = map.get(key) ?? { key, name: o.name, phone: o.phone, governorate: o.governorate, orders: [], spent: 0, count: 0, last: o.created_at, userIds: [], number: null };
    c.orders.push(o);
    if (isCounted(o.status)) { c.spent += Number(o.total) || 0; c.count++; }
    if (o.created_at >= c.last || c.orders.length === 1) { c.last = o.created_at; if (!c.number) c.name = o.name; c.governorate = o.governorate || c.governorate; if (!c.phone) c.phone = o.phone; }
    if (o.user_id && !c.userIds.includes(o.user_id)) { c.userIds.push(o.user_id); c.number ??= customerNumber(o.user_id); }
    map.set(key, c);
  }
  return [...map.values()];
}
const tier = (c: Customer) => (c.count >= 3 ? "VIP" : c.count === 2 ? "Returning" : c.count === 1 ? "New" : "No orders");
const sel = "h-10 border border-border bg-background px-2 text-sm outline-none focus:border-primary";

export function CustomersTab({ onMessage }: { onMessage?: (num: number) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [q, setQ] = useState("");
  const [acct, setAcct] = useState<"all" | "signed" | "guest">("all");
  const [cnt, setCnt] = useState("all");
  const [loc, setLoc] = useState("");
  const [sort, setSort] = useState("spent-desc");
  const [open, setOpen] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name,phone,governorate,created_at"),
      supabase.from("product_ratings").select("product_id,user_id,stars"),
    ]).then(([o, p, r]) => { setOrders((o.data ?? []) as Order[]); setProfiles((p.data ?? []) as Profile[]); setRatings((r.data ?? []) as Rating[]); setBusy(false); });
  }, []);

  const customers = useMemo(() => groupCustomers(orders, profiles), [orders, profiles]);
  const locations = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) if (o.governorate && isCounted(o.status)) m.set(o.governorate, (m.get(o.governorate) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [orders]);
  const s = q.trim().toLowerCase().replace(/^#/, "");
  const sd = phoneKey(q);
  const shown = customers.filter((c) =>
    (acct === "all" || (acct === "signed") === (c.number != null)) &&
    (cnt === "all" || (cnt === "vip" ? c.count >= 3 : c.count === Number(cnt))) &&
    (!loc || c.governorate === loc) &&
    (!s || c.name.toLowerCase().includes(s) || (c.number != null && String(c.number).includes(s)) || (sd.length >= 3 && phoneKey(c.phone).includes(sd)) || c.orders.some((o) => o.order_code.toLowerCase().includes(s))),
  ).sort((a, b) => sort === "spent-asc" ? a.spent - b.spent : sort === "orders" ? b.count - a.count : sort === "recent" ? b.last.localeCompare(a.last) : b.spent - a.spent);
  const pname = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const buyers = customers.filter((c) => c.count > 0);
  const total = buyers.reduce((a, c) => a + c.spent, 0);
  const maxLoc = locations[0]?.[1] ?? 1;

  if (busy) return <p className="text-sm text-muted-foreground">Loading customers…</p>;
  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Customers", customers.length], ["Signed up", customers.filter((c) => c.number != null).length], ["VIP (3+)", customers.filter((c) => c.count >= 3).length], ["Avg spend", `$${buyers.length ? Math.round(total / buyers.length) : 0}`]].map(([l, v]) => (
          <div key={l as string} className="glass border border-border p-3"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</p><p className="font-display text-2xl font-semibold">{v}</p></div>
        ))}
      </div>
      {locations.length > 0 && (
        <div className="mb-6 border border-border p-4">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Where orders come from — tap to filter</p>
          <div className="space-y-1.5">
            {locations.slice(0, 8).map(([g, n]) => (
              <button key={g} onClick={() => setLoc(loc === g ? "" : g)} className={`flex w-full items-center gap-3 text-left text-xs ${loc === g ? "font-bold text-primary" : ""}`}>
                <span className="w-24 shrink-0 truncate">{g}</span>
                <span className="h-2 flex-1 bg-muted"><span className="block h-2 bg-primary" style={{ width: `${(n / maxLoc) * 100}%` }} /></span>
                <span className="w-8 text-right">{n}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, #VC code or customer #" className="h-10 min-w-0 flex-1 basis-full border border-border bg-background px-3 text-sm outline-none focus:border-primary sm:basis-auto" />
        <select className={sel} value={acct} onChange={(e) => setAcct(e.target.value as typeof acct)}><option value="all">Everyone</option><option value="signed">Signed up</option><option value="guest">Guests</option></select>
        <select className={sel} value={cnt} onChange={(e) => setCnt(e.target.value)}><option value="all">Any orders</option><option value="0">0 orders</option><option value="1">1 order</option><option value="2">2 orders</option><option value="vip">VIP 3+</option></select>
        <select className={sel} value={loc} onChange={(e) => setLoc(e.target.value)}><option value="">All places</option>{locations.map(([g]) => <option key={g}>{g}</option>)}</select>
        <select className={sel} value={sort} onChange={(e) => setSort(e.target.value)}><option value="spent-desc">Most spent</option><option value="spent-asc">Least spent</option><option value="orders">Most orders</option><option value="recent">Most recent</option></select>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{shown.length} shown · Grey = guest (not signed up) · Canceled/declined orders don't count.</p>
      {shown.length === 0 && <p className="text-sm text-muted-foreground">No customers found.</p>}
      <div className="grid gap-2">
        {shown.map((c) => {
          const t = tier(c);
          const guest = c.number == null;
          const myRatings = ratings.filter((r) => c.userIds.includes(r.user_id));
          const isOpen = open === c.key;
          return (
            <div key={c.key} className={`border ${guest ? "border-border bg-muted/60 text-muted-foreground" : "glass border-primary/40"}`}>
              <button onClick={() => setOpen(isOpen ? "" : c.key)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
                <div className="min-w-0">
                  <p className={`font-semibold ${guest ? "" : "text-foreground"}`}>
                    {c.name}
                    {guest ? <span className="ml-2 border border-border px-1.5 py-0.5 text-[10px] uppercase">Guest</span>
                      : <span className="ml-2 bg-primary px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground">#{c.number}</span>}
                    <span className={`ml-1 border px-1.5 py-0.5 text-[10px] uppercase ${t === "VIP" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{t}</span>
                  </p>
                  {(() => { const ar = c.orders.find((o) => /[\u0600-\u06FF]/.test(o.name))?.name; return ar && ar !== c.name ? <p className="text-xs text-foreground" dir="rtl">اسم الشحن: {ar}</p> : null; })()}
                  <p className="text-xs text-muted-foreground">{c.phone || "No phone"} · {c.governorate || "—"}</p>
                </div>
                <div className="flex gap-5 text-right text-sm">
                  <div><p className="text-[10px] uppercase text-muted-foreground">Orders</p><p className="font-semibold">{c.count}</p></div>
                  <div><p className="text-[10px] uppercase text-muted-foreground">Spent</p><p className="font-semibold">${c.spent}</p></div>
                  <div><p className="text-[10px] uppercase text-muted-foreground">Ratings</p><p className="font-semibold">{myRatings.length}</p></div>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-border p-4 text-sm text-foreground">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {c.phone && <a className="btn btn-primary h-9 px-3 text-[10px]" href={`https://wa.me/963${phoneKey(c.phone)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                    {c.phone && <button className="btn btn-ghost h-9 px-3 text-[10px]" onClick={() => navigator.clipboard?.writeText(c.phone)}>Copy phone</button>}
                    {c.number != null && <button className="btn btn-ghost h-9 px-3 text-[10px]" onClick={() => navigator.clipboard?.writeText("#" + c.number)}>Copy #{c.number}</button>}
                    {c.number != null && onMessage && <button className="btn btn-ghost h-9 px-3 text-[10px]" onClick={() => onMessage(c.number!)}>Send message / coupon</button>}
                    <span className="self-center text-xs text-muted-foreground">{c.orders.length ? `Last order ${new Date(c.last).toLocaleDateString()}` : `Joined ${new Date(c.last).toLocaleDateString()}`}</span>
                  </div>
                  {c.orders.length === 0 ? <p className="text-xs text-muted-foreground">No orders yet.</p> : (
                    <ul className="divide-y divide-border">
                      {c.orders.map((o) => (
                        <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <span className="font-mono font-semibold">{o.order_code}</span>
                          <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</span>
                          <StatusBadge s={normStatus(o.status)} />
                          <span className="font-semibold">${o.total}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">Ratings</p>
                  {myRatings.length === 0
                    ? <p className="text-xs text-muted-foreground">No ratings (only signed-in customers can rate).</p>
                    : <ul className="mt-1 space-y-1">{myRatings.map((r) => <li key={r.product_id}>{pname(r.product_id)} — <span className="text-primary">{"★".repeat(r.stars)}</span>{"☆".repeat(5 - r.stars)}</li>)}</ul>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
