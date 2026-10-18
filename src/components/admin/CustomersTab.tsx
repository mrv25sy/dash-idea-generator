import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/store-client";
import { products } from "@/data/products";
import { StatusBadge, normStatus } from "@/lib/order-status";

type Order = { id: string; order_code: string; name: string; phone: string; governorate: string; total: number; status: string; created_at: string; user_id: string | null; items: unknown };
type Rating = { product_id: string; user_id: string; stars: number };
export type Customer = { key: string; name: string; phone: string; governorate: string; orders: Order[]; spent: number; count: number; last: string; userIds: string[] };

/** Same customer = same phone number, ignoring spaces, +963 / 00963 / leading 0. */
export const phoneKey = (p: string) => {
  let d = (p || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("963")) d = d.slice(3);
  return d.replace(/^0+/, "");
};
const isCounted = (s: string) => !["Canceled", "Declined"].includes(normStatus(s));

export function groupCustomers(orders: Order[]): Customer[] {
  const map = new Map<string, Customer>();
  for (const o of orders) {
    const key = phoneKey(o.phone) || o.name.trim().toLowerCase();
    const c = map.get(key) ?? { key, name: o.name, phone: o.phone, governorate: o.governorate, orders: [], spent: 0, count: 0, last: o.created_at, userIds: [] };
    c.orders.push(o);
    if (isCounted(o.status)) { c.spent += Number(o.total) || 0; c.count++; }
    if (o.created_at >= c.last) { c.last = o.created_at; c.name = o.name; c.governorate = o.governorate; }
    if (o.user_id && !c.userIds.includes(o.user_id)) c.userIds.push(o.user_id);
    map.set(key, c);
  }
  return [...map.values()].sort((a, b) => b.spent - a.spent);
}
const tier = (c: Customer) => (c.count >= 3 ? "VIP" : c.count === 2 ? "Returning" : "New");

export function CustomersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"All" | "VIP" | "Returning" | "New">("All");
  const [open, setOpen] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("product_ratings").select("product_id,user_id,stars"),
    ]).then(([o, r]) => { setOrders((o.data ?? []) as Order[]); setRatings((r.data ?? []) as Rating[]); setBusy(false); });
  }, []);

  const customers = useMemo(() => groupCustomers(orders), [orders]);
  const s = q.trim().toLowerCase();
  const sd = phoneKey(q);
  const shown = customers.filter((c) =>
    (only === "All" || tier(c) === only) &&
    (!s || c.name.toLowerCase().includes(s) || (sd && phoneKey(c.phone).includes(sd)) || c.orders.some((o) => o.order_code.toLowerCase().includes(s))));
  const pname = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const total = customers.reduce((a, c) => a + c.spent, 0);

  if (busy) return <p className="text-sm text-muted-foreground">Loading customers…</p>;
  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[["Customers", customers.length], ["Repeat buyers", customers.filter((c) => c.count >= 2).length], ["Avg spend", `$${customers.length ? Math.round(total / customers.length) : 0}`]].map(([l, v]) => (
          <div key={l as string} className="glass border border-border p-3"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</p><p className="font-display text-2xl font-semibold">{v}</p></div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or #VC code" className="h-10 min-w-0 flex-1 border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
        {(["All", "VIP", "Returning", "New"] as const).map((t) => (
          <button key={t} onClick={() => setOnly(t)} className={`btn h-10 px-3 text-[10px] ${only === t ? "btn-primary" : "btn-ghost"}`}>{t}</button>
        ))}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">VIP = 3+ orders · Canceled/declined orders don't count toward spend.</p>
      {shown.length === 0 && <p className="text-sm text-muted-foreground">No customers found.</p>}
      <div className="grid gap-2">
        {shown.map((c) => {
          const t = tier(c);
          const myRatings = ratings.filter((r) => c.userIds.includes(r.user_id));
          const isOpen = open === c.key;
          return (
            <div key={c.key} className="glass border border-border">
              <button onClick={() => setOpen(isOpen ? "" : c.key)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
                <div className="min-w-0">
                  <p className="font-semibold">{c.name} <span className={`ml-1 border px-1.5 py-0.5 text-[10px] uppercase ${t === "VIP" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{t}</span></p>
                  <p className="text-xs text-muted-foreground">{c.phone} · {c.governorate}</p>
                </div>
                <div className="flex gap-5 text-right text-sm">
                  <div><p className="text-[10px] uppercase text-muted-foreground">Orders</p><p className="font-semibold">{c.count}</p></div>
                  <div><p className="text-[10px] uppercase text-muted-foreground">Spent</p><p className="font-semibold">${c.spent}</p></div>
                  <div><p className="text-[10px] uppercase text-muted-foreground">Ratings</p><p className="font-semibold">{myRatings.length}</p></div>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-border p-4 text-sm">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <a className="btn btn-primary h-9 px-3 text-[10px]" href={`https://wa.me/963${phoneKey(c.phone)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                    <button className="btn btn-ghost h-9 px-3 text-[10px]" onClick={() => navigator.clipboard?.writeText(c.phone)}>Copy phone</button>
                    <span className="self-center text-xs text-muted-foreground">Last order {new Date(c.last).toLocaleDateString()}</span>
                  </div>
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
