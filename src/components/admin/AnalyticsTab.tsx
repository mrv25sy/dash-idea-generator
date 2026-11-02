import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MapPin, Package, RefreshCw, TrendingDown, TrendingUp, Wallet, Receipt } from "lucide-react";
import { supabase } from "@/lib/store-client";

type Order = { id: string; order_code: string; governorate: string; items: unknown; total: number; status: string; created_at: string };

const RANGES = [
  { k: "7d", l: "Week", days: 7 },
  { k: "30d", l: "Month", days: 30 },
  { k: "90d", l: "3 Months", days: 90 },
  { k: "180d", l: "6 Months", days: 180 },
  { k: "365d", l: "Year", days: 365 },
  { k: "all", l: "All time", days: 0 },
] as const;
type RangeKey = (typeof RANGES)[number]["k"];

const DAY = 86400000;
const norm = (s: string) => { const n = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); return n === "Delivered" ? "Completed" : n; };
const isLost = (s: string) => ["Cancelled", "Canceled", "Declined", "Rejected"].includes(norm(s));
const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
const short = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : String(Math.round(n));

export function AnalyticsTab() {
  const [rows, setRows] = useState<Order[]>([]);
  const [range, setRange] = useState<RangeKey>("30d");
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const load = async () => {
    setBusy(true);
    const { data } = await supabase.from("orders").select("id,order_code,governorate,items,total,status,created_at").order("created_at");
    setRows((data ?? []) as Order[]);
    setNow(Date.now());
    setBusy(false);
  };
  useEffect(() => { load(); }, []);

  const r = RANGES.find((x) => x.k === range)!;
  const stats = useMemo(() => {
    const good = rows.filter((o) => !isLost(o.status));
    const t = (o: Order) => new Date(o.created_at).getTime();
    const first = good.length ? t(good[0]!) : now;
    const days = r.days || Math.max(7, Math.ceil((now - first) / DAY) + 1);
    const start = now - days * DAY;
    const cur = good.filter((o) => t(o) >= start);
    const prev = r.days ? good.filter((o) => t(o) >= start - days * DAY && t(o) < start) : [];
    const sum = (a: Order[]) => a.reduce((s, o) => s + Number(o.total || 0), 0);
    const revenue = sum(cur), prevRevenue = sum(prev);
    const pct = (a: number, b: number) => (r.days && b > 0 ? ((a - b) / b) * 100 : null);

    // Buckets: daily up to 31 days, weekly up to ~6 months, monthly beyond.
    const step = days <= 31 ? "day" : days <= 190 ? "week" : "month";
    const buckets: { key: string; label: string; revenue: number; orders: number }[] = [];
    const keyOf = (ms: number) => {
      const d = new Date(ms);
      if (step === "day") return d.toISOString().slice(0, 10);
      if (step === "month") return `${d.getFullYear()}-${d.getMonth()}`;
      return String(Math.floor((ms - start) / (7 * DAY)));
    };
    const map = new Map<string, (typeof buckets)[number]>();
    for (let ms = start; ms <= now; ms += step === "month" ? 28 * DAY : step === "week" ? 7 * DAY : DAY) {
      const k = keyOf(ms);
      if (map.has(k)) continue;
      const d = new Date(ms);
      const label = step === "month" ? d.toLocaleDateString("en-US", { month: "short" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const b = { key: k, label, revenue: 0, orders: 0 };
      map.set(k, b); buckets.push(b);
    }
    for (const o of cur) { const b = map.get(keyOf(t(o))); if (b) { b.revenue += Number(o.total || 0); b.orders++; } }

    const byGov: Record<string, { orders: number; revenue: number }> = {};
    for (const o of cur) { const g = o.governorate || "Unknown"; byGov[g] ??= { orders: 0, revenue: 0 }; byGov[g].orders++; byGov[g].revenue += Number(o.total || 0); }

    const products: Record<string, number> = {};
    for (const o of cur) for (const it of (Array.isArray(o.items) ? o.items : []) as any[]) {
      if (it?.kind !== "single" && it?.kind !== "bundle" && !it?.pieces) continue;
      for (const pc of it.pieces ?? []) products[pc.name ?? pc.productId] = (products[pc.name ?? pc.productId] ?? 0) + Number(it.qty || 1);
    }
    const allCur = rows.filter((o) => t(o) >= start);
    const completed = cur.filter((o) => norm(o.status) === "Completed").length;
    return {
      revenue, orders: cur.length, aov: cur.length ? revenue / cur.length : 0,
      revPct: pct(revenue, prevRevenue), ordPct: pct(cur.length, prev.length),
      aovPct: pct(cur.length ? revenue / cur.length : 0, prev.length ? prevRevenue / prev.length : 0),
      buckets, byGov, recent: cur,
      top: Object.entries(products).sort((a, b) => b[1] - a[1]).slice(0, 5),
      completion: allCur.length ? (completed / allCur.length) * 100 : 0,
      lost: allCur.filter((o) => isLost(o.status)).length,
    };
  }, [rows, range, now]);

  const govs = Object.entries(stats.byGov).sort((a, b) => b[1].revenue - a[1].revenue);
  const maxGov = Math.max(1, ...govs.map(([, v]) => v.orders));
  const stamp = now ? new Date(now).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "";

  return (
    <div className="analytics space-y-5">
      {(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-full border border-border p-1">
            {RANGES.map((x) => (
              <button key={x.k} onClick={() => setRange(x.k)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${range === x.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{x.l}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="btn btn-ghost h-9 gap-2"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />Refresh</button>
          </div>
        </div>
      )}

      <div className="an-panel relative overflow-hidden rounded-2xl border border-border p-5 sm:p-8">
        <div className="an-glow" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-primary">Vice · Growth pulse</p>
            <h2 className="mt-1 font-display text-3xl font-semibold uppercase sm:text-5xl">{r.l === "All time" ? "All time" : `This ${r.l.toLowerCase()}`}</h2>
          </div>
          <p className="text-xs text-muted-foreground">{stamp}</p>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<Wallet className="h-4 w-4" />} label="Revenue" value={`$${fmt(stats.revenue)}`} unit="USD" pct={stats.revPct} big />
          <Kpi icon={<Receipt className="h-4 w-4" />} label="Orders" value={fmt(stats.orders)} pct={stats.ordPct} />
          <Kpi icon={<Package className="h-4 w-4" />} label="Avg. order" value={`$${short(stats.aov)}`} unit="USD" pct={stats.aovPct} />
          <Kpi icon={<MapPin className="h-4 w-4" />} label="Top city" value={govs[0]?.[0] ?? "—"} sub={govs[0] ? `${govs[0][1].orders} orders` : "No orders yet"} />
        </div>

        <div className="relative mt-5 grid gap-4 lg:grid-cols-5">
          <div className="an-card lg:col-span-3">
            <CardHead title="Revenue" note="USD" />
            <div className="h-56">
              <ResponsiveContainer>
                <AreaChart data={stats.buckets} margin={{ top: 10, right: 6, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="anRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={18} />
                  <YAxis tickFormatter={short} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<Tip unit="USD" />} cursor={{ stroke: "var(--primary)", strokeDasharray: "3 3" }} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5} fill="url(#anRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="an-card lg:col-span-2">
            <CardHead title="Orders" note={`${stats.completion.toFixed(0)}% completed`} />
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={stats.buckets} margin={{ top: 10, right: 6, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={18} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip content={<Tip unit="orders" />} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="orders" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="relative mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="an-card">
              <CardHead title="Top cities" />
              <ul className="space-y-2.5">
                {govs.slice(0, 5).map(([g, v]) => (
                  <li key={g}>
                    <div className="flex justify-between text-xs"><span className="font-semibold">{g}</span><span className="text-muted-foreground">{v.orders} · ${short(v.revenue)}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(v.orders / maxGov) * 100}%` }} /></div>
                  </li>
                ))}
                {!govs.length && <li className="text-xs text-muted-foreground">No orders in this period.</li>}
              </ul>
            </div>
            <div className="an-card">
              <CardHead title="Best sellers" note="pieces" />
              <ol className="space-y-2">
                {stats.top.map(([n, q], i) => (
                  <li key={n} className="flex items-center gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-bold">{i + 1}</span>
                    <span className="flex-1 truncate">{n}</span><span className="font-semibold">{q}</span>
                  </li>
                ))}
                {!stats.top.length && <li className="text-xs text-muted-foreground">Nothing sold yet.</li>}
              </ol>
            </div>
          </div>
        </div>
        <p className="relative mt-5 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Cancelled & declined orders excluded{stats.lost ? ` · ${stats.lost} lost this period` : ""}</p>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, unit, pct, sub, big }: { icon: React.ReactNode; label: string; value: string; unit?: string; pct?: number | null; sub?: string; big?: boolean }) {
  const up = (pct ?? 0) >= 0;
  return (
    <div className={`an-card ${big ? "an-card-hot" : ""}`}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">{icon}{label}</div>
      <p className="mt-3 truncate font-display text-2xl font-semibold sm:text-3xl">{value}{unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}</p>
      {pct != null ? (
        <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${up ? "text-primary" : "text-muted-foreground"}`}>{up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{up ? "+" : ""}{pct.toFixed(1)}% vs previous</p>
      ) : <p className="mt-1 text-xs text-muted-foreground">{sub ?? "\u00a0"}</p>}
    </div>
  );
}

function CardHead({ title, note }: { title: string; note?: string }) {
  return <div className="mb-3 flex items-baseline justify-between"><h3 className="text-[11px] font-semibold uppercase tracking-[0.25em]">{title}</h3>{note && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{note}</span>}</div>;
}

function Tip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return <div className="an-tip"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="text-sm font-semibold">{fmt(payload[0].value)} {unit}</p></div>;
}
