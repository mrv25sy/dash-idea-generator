import { ADMIN_EMAIL } from "@/config";
import { ORDER_STATUSES, StatusBadge } from "@/lib/order-status";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { loadCatalog, resolveImage } from "@/data/products";
import { DropsTab, SectionsTab, BannersTab } from "@/components/admin/ContentTabs";
import { BroadcastTab } from "@/components/admin/BroadcastTab";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin — Vice" },
      { name: "description", content: "Vice store admin: manage designs, bundles and orders." },
      { property: "og:title", content: "Admin — Vice" },
      { property: "og:description", content: "Vice store admin dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const input = "h-11 w-full border border-border bg-background px-3 text-sm outline-none focus:border-primary";
const label = "nav-link mb-1 block";

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    if ((session.user.email ?? "").toLowerCase() !== ADMIN_EMAIL) { setIsAdmin(false); return; }
    supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  if (!ready) return <Shell><p className="text-sm text-muted-foreground">Loading…</p></Shell>;
  if (!session) return <Shell><Login /></Shell>;
  if (isAdmin === null) return <Shell><p className="text-sm text-muted-foreground">Checking access…</p></Shell>;
  if (!isAdmin) return (
    <Shell>
      <p className="text-sm">This account ({session.user.email}) is not the store admin.</p>
      <button className="btn btn-ghost mt-4" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </Shell>
  );
  return <Dashboard email={session.user.email ?? ""} />;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <h1 className="mb-8 font-display text-4xl font-semibold uppercase">Admin</h1>
      {children}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    if (email.trim().toLowerCase() !== ADMIN_EMAIL) { setMsg("Access denied: this portal is only for the store owner."); setBusy(false); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg("Wrong email or password.");
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="glass space-y-4 border border-border p-6">
      <div><label className={label}>Email</label><input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><label className={label}>Password</label><input className={input} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {msg && <p className="text-sm text-primary">{msg}</p>}
      <button disabled={busy} className="btn btn-primary w-full">Sign in</button>
    </form>
  );
}

type ProductRow = {
  id: string; name: string; price: number; images: string[]; colors: { name: string; hex: string }[]; sizes: string[];
  category: string; type: string; drop_name: string | null; in_stock: boolean; coming_soon: boolean; badge: string | null; sort: number;
  description: string | null; details: { label: string; value: string }[]; sale_price: number | null;
};
type BundleRow = { id: string; name: string; product_ids: string[]; price: number; sort: number };
type OrderRow = { id: string; order_code: string; name: string; phone: string; governorate: string; address: string; notes: string | null; items: unknown; total: number; status: string; created_at: string };

function Dashboard({ email }: { email: string }) {
  const [tab, setTab] = useState<"products" | "bundles" | "orders" | "drops" | "sections" | "banners" | "inbox">("orders");
  const [rk, setRk] = useState(0);
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold uppercase">Admin</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">{email}</span>
          <button className="btn btn-primary h-9" onClick={async () => { await loadCatalog(true); setRk((k) => k + 1); }}>↻ Refresh</button>
          <button className="btn btn-ghost h-9" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
      <div className="mb-8 flex gap-2 overflow-x-auto border-b border-border">
        {(["orders", "products", "drops", "bundles", "sections", "banners", "inbox"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`nav-link -mb-px whitespace-nowrap border-b-2 px-4 py-3 ${tab === t ? "border-primary text-foreground" : "border-transparent"}`}>{t === "products" ? "Designs" : t === "inbox" ? "Messages" : t}</button>
        ))}
      </div>
      {tab === "products" && <ProductsTab key={rk} />}
      {tab === "bundles" && <BundlesTab key={rk} />}
      {tab === "orders" && <OrdersTab key={rk} />}
      {tab === "drops" && <DropsTab key={rk} />}
      {tab === "sections" && <SectionsTab key={rk} />}
      {tab === "banners" && <BannersTab key={rk} />}
      {tab === "inbox" && <BroadcastTab key={rk} />}
    </div>
  );
}

const AVAIL = [{ v: "in", l: "In stock" }, { v: "out", l: "Sold out" }, { v: "soon", l: "Soon" }];
const statusOf = (p: { in_stock: boolean; coming_soon: boolean }) => (p.coming_soon ? "soon" : p.in_stock ? "in" : "out");
const statusFields = (st: string) => ({ in_stock: st === "in", coming_soon: st === "soon" });
const PRESET_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "One size"];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `item-${Date.now()}`;

function ProductsTab() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const load = async () => {
    const { data } = await supabase.from("products").select("*").order("sort").order("created_at");
    setRows((data ?? []) as unknown as ProductRow[]);
  };
  useEffect(() => { load(); }, []);
  const after = async () => { await load(); await loadCatalog(true); };

  const setStatus = async (p: ProductRow, st: string) => { await supabase.from("products").update(statusFields(st)).eq("id", p.id); after(); };
  const remove = async (p: ProductRow) => { if (!confirm(`Remove ${p.name}?`)) return; await supabase.from("products").delete().eq("id", p.id); after(); };

  if (editing) return <ProductForm initial={editing} onDone={() => { setEditing(null); after(); }} />;
  return (
    <div>
      <button className="btn btn-primary mb-6" onClick={() => setEditing({ id: "", name: "", price: 0, images: [], colors: [{ name: "Black", hex: "#0d0d0d" }], sizes: ["S", "M", "L", "XL", "XXL"], category: "tee", type: "single", drop_name: null, in_stock: true, coming_soon: false, badge: null, sort: rows.length + 1, description: "", details: [], sale_price: null })}>+ Add design</button>
      <div className="grid gap-3">
        {rows.map((p) => (
          <div key={p.id} className="glass flex items-center gap-4 border border-border p-3">
            <img src={resolveImage(p.images[0] ?? "")} alt="" className="h-16 w-14 shrink-0 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium uppercase">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.sale_price != null && p.sale_price < p.price ? <><s>${p.price}</s> <b className="text-destructive">${p.sale_price} SALE</b></> : `$${p.price}`} · {p.category} · {p.type}{p.drop_name ? ` (${p.drop_name})` : ""}</p>
            </div>
            <select value={statusOf(p)} onChange={(e) => setStatus(p, e.target.value)} className="h-9 border border-border bg-background px-2 text-xs">{AVAIL.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select>
            <button onClick={() => setEditing(p)} className="btn btn-ghost h-9 px-3 text-[10px]">Edit</button>
            <button onClick={() => remove(p)} className="btn btn-ghost h-9 px-3 text-[10px]">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const PRESET_CATS = ["hoodie", "tee", "cap", "vest", "sweater", "jeans", "carpet", "accessory"];
const CAT_KEY = "vice-custom-categories";
function CategoryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    let saved: string[] = [];
    try { saved = JSON.parse(localStorage.getItem(CAT_KEY) || "[]"); } catch { /* ignore */ }
    supabase.from("products").select("category").then(({ data }) => {
      const fromDb = (data ?? []).map((r: { category: string }) => r.category).filter(Boolean);
      setCustom([...new Set([...saved, ...fromDb])].filter((c) => !PRESET_CATS.includes(c)));
    });
    setCustom(saved);
  }, []);
  const save = (list: string[]) => { setCustom(list); localStorage.setItem(CAT_KEY, JSON.stringify(list)); };
  const add = () => {
    const v = draft.trim().toLowerCase();
    if (!v) return;
    if (!PRESET_CATS.includes(v) && !custom.includes(v)) save([...custom, v]);
    onChange(v); setDraft(""); setAdding(false);
  };
  const all = [...PRESET_CATS, ...custom];
  if (value && !all.includes(value)) all.push(value);
  return (
    <div><label className={label}>Category</label>
      {adding ? (
        <div className="flex gap-2">
          <input autoFocus className={input} value={draft} placeholder="New category, e.g. jacket" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" onClick={add} className="btn btn-primary h-11 shrink-0">Save</button>
          <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost h-11 shrink-0">×</button>
        </div>
      ) : (
        <select className={input} value={value} onChange={(e) => e.target.value === "__new" ? setAdding(true) : onChange(e.target.value)}>
          {all.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="__new">+ Add custom category…</option>
        </select>
      )}
      {custom.includes(value) && !adding && (
        <button type="button" onClick={() => save(custom.filter((c) => c !== value))} className="mt-1 text-[10px] text-muted-foreground underline">Remove "{value}" from saved categories</button>
      )}
    </div>
  );
}

function ProductForm({ initial, onDone }: { initial: ProductRow; onDone: () => void }) {
  const isNew = !initial.id;
  const [p, setP] = useState(initial);
  const [colorsText, setColorsText] = useState(initial.colors.map((c) => `${c.name}:${c.hex}`).join(", "));
  const [customSize, setCustomSize] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const allSizes = [...PRESET_SIZES, ...p.sizes.filter((s) => !PRESET_SIZES.includes(s))];
  const toggleSize = (sz: string) => set("sizes", p.sizes.includes(sz) ? p.sizes.filter((x) => x !== sz) : [...p.sizes, sz]);
  const addCustom = () => { const v = customSize.trim(); if (v && !p.sizes.includes(v)) set("sizes", [...p.sizes, v]); setCustomSize(""); };
  const setDetail = (i: number, k: "label" | "value", v: string) => set("details", p.details.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const set = <K extends keyof ProductRow>(k: K, v: ProductRow[K]) => setP((x) => ({ ...x, [k]: v }));

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr("");
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${f.name.split(".").pop()}`;
      const up = await supabase.storage.from("product-images").upload(path, f, { contentType: f.type });
      if (up.error) { setErr(up.error.message); continue; }
      const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (data?.signedUrl) urls.push(data.signedUrl);
    }
    setP((x) => ({ ...x, images: [...x.images, ...urls] }));
    setBusy(false);
  };

  const save = async () => {
    if (!p.name.trim()) return setErr("Enter a name");
    setBusy(true); setErr("");
    const colors = colorsText.split(",").map((s) => s.trim()).filter(Boolean).map((s) => { const [name, hex] = s.split(":"); return { name: (name ?? "").trim(), hex: (hex ?? "#000000").trim() }; });
    const row = { ...p, id: isNew ? slug(p.name) : p.id, colors, price: Number(p.price), drop_name: p.type === "drop" ? p.drop_name || "Night Shift" : null, badge: p.badge || null,
      category: p.category.trim().toLowerCase() || "tee", description: p.description?.trim() || null,
      details: p.details.filter((d) => d.label.trim() && d.value.trim()),
      sale_price: p.sale_price == null || Number.isNaN(Number(p.sale_price)) || Number(p.sale_price) <= 0 ? null : Number(p.sale_price) };
    if (row.sale_price != null && row.sale_price >= row.price) { setBusy(false); return setErr("Sale price must be lower than the regular price"); }
    const { error } = isNew ? await supabase.from("products").insert(row) : await supabase.from("products").update(row).eq("id", p.id);
    setBusy(false);
    if (error) return setErr(error.message);
    onDone();
  };

  return (
    <div className="glass max-w-2xl space-y-4 border border-border p-6">
      <h2 className="font-display text-2xl font-semibold uppercase">{isNew ? "New design" : "Edit design"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label}>Name</label><input className={input} value={p.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label className={label}>Price (USD)</label><input className={input} type="number" min={0} value={p.price} onChange={(e) => set("price", Number(e.target.value))} /></div>
        <CategoryPicker value={p.category} onChange={(v) => set("category", v)} />
        <div><label className={label}>Sale price (leave empty = no sale)</label><input className={input} type="number" min={0} value={p.sale_price ?? ""} onChange={(e) => set("sale_price", e.target.value === "" ? null : Number(e.target.value))} /></div>
        <div><label className={label}>Section</label>
          <select className={input} value={p.type.startsWith("section:") ? "section" : p.type} onChange={(e) => set("type", e.target.value === "section" ? "section:" : e.target.value)}>
            <option value="single">Singles</option><option value="drop">Drop</option><option value="section">Custom section…</option>
          </select></div>
        {p.type === "drop" && <div><label className={label}>Drop name</label><input className={input} value={p.drop_name ?? ""} onChange={(e) => set("drop_name", e.target.value)} /></div>}
        {p.type.startsWith("section:") && <div><label className={label}>Custom section name</label><input className={input} value={p.type.slice(8)} placeholder="e.g. Summer Picks" onChange={(e) => set("type", `section:${e.target.value}`)} /></div>}
        <div><label className={label}>Badge (optional)</label><input className={input} value={p.badge ?? ""} placeholder="New" onChange={(e) => set("badge", e.target.value)} /></div>
        <div className="sm:col-span-2"><label className={label}>Available sizes</label>
          <div className="flex flex-wrap gap-2">
            {allSizes.map((sz) => (
              <label key={sz} className={`flex h-10 cursor-pointer items-center gap-2 border px-3 text-xs font-semibold uppercase ${p.sizes.includes(sz) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                <input type="checkbox" className="sr-only" checked={p.sizes.includes(sz)} onChange={() => toggleSize(sz)} />{sz}
              </label>
            ))}
          </div>
          <div className="mt-2 flex gap-2"><input className={input} value={customSize} placeholder="Custom size, e.g. 2×3 m²" onChange={(e) => setCustomSize(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} /><button type="button" onClick={addCustom} className="btn btn-ghost h-11 shrink-0">+ Add size</button></div>
        </div>
        <div className="sm:col-span-2"><label className={label}>Description (shown on the product page)</label><textarea className={`${input} h-28 py-2`} value={p.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
        <div className="sm:col-span-2"><label className={label}>Details (e.g. Material: Cotton, Area: 6 m²)</label>
          <div className="space-y-2">
            {p.details.map((d, i) => (
              <div key={i} className="flex gap-2">
                <input className={input} placeholder="Name" value={d.label} onChange={(e) => setDetail(i, "label", e.target.value)} />
                <input className={input} placeholder="Value" value={d.value} onChange={(e) => setDetail(i, "value", e.target.value)} />
                <button type="button" onClick={() => set("details", p.details.filter((_, j) => j !== i))} className="btn btn-ghost h-11 shrink-0">×</button>
              </div>
            ))}
            <button type="button" onClick={() => set("details", [...p.details, { label: "", value: "" }])} className="btn btn-ghost h-9 text-[10px]">+ Add detail</button>
          </div>
        </div>
        <div className="sm:col-span-2"><label className={label}>Colors (Name:#hex, comma separated)</label><input className={input} value={colorsText} onChange={(e) => setColorsText(e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        {AVAIL.map((a) => (
          <label key={a.v} className="flex items-center gap-2"><input type="radio" name="avail" checked={statusOf(p) === a.v} onChange={() => setP((x) => ({ ...x, ...statusFields(a.v) }))} /> {a.l}</label>
        ))}
        <span className="text-xs text-muted-foreground">"Soon" blurs the photo on the shop.</span>
      </div>
      <div>
        <label className={label}>Photos</label>
        <div className="flex flex-wrap gap-2">
          {p.images.map((src, i) => (
            <div key={src + i} className="relative">
              <img src={resolveImage(src)} alt="" className="h-24 w-20 object-cover" />
              <button type="button" onClick={() => set("images", p.images.filter((_, j) => j !== i))} className="absolute right-0 top-0 bg-primary px-1.5 text-xs text-primary-foreground">×</button>
            </div>
          ))}
        </div>
        <input type="file" accept="image/*" multiple className="mt-3 text-sm" onChange={(e) => upload(e.target.files)} />
      </div>
      {err && <p className="text-sm text-primary">{err}</p>}
      <div className="flex gap-3">
        <button disabled={busy} onClick={save} className="btn btn-primary">{busy ? "Saving…" : "Save changes"}</button>
        <button onClick={onDone} className="btn btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

function BundlesTab() {
  const [rows, setRows] = useState<BundleRow[]>([]);
  const [prods, setProds] = useState<{ id: string; name: string; price: number }[]>([]);
  const sumOf = (ids: string[]) => ids.reduce((s, id) => s + Number(prods.find((p) => p.id === id)?.price ?? 0), 0);
  const [editing, setEditing] = useState<BundleRow | null>(null);
  const [err, setErr] = useState("");
  const load = async () => {
    const [b, p] = await Promise.all([supabase.from("bundles").select("*").order("sort"), supabase.from("products").select("id,name,price").order("sort")]);
    setRows((b.data ?? []) as BundleRow[]); setProds(p.data ?? []);
  };
  useEffect(() => { load(); }, []);
  const after = async () => { await load(); await loadCatalog(true); };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim() || editing.product_ids.length < 2) return setErr("Give it a name and pick at least 2 pieces");
    if (Number(editing.price) >= sumOf(editing.product_ids)) return setErr("Bundle price should be lower than the pieces bought separately");
    const isNew = !editing.id;
    const row = { ...editing, id: isNew ? slug(editing.name) : editing.id, price: Number(editing.price) };
    const { error } = isNew ? await supabase.from("bundles").insert(row) : await supabase.from("bundles").update(row).eq("id", editing.id);
    if (error) return setErr(error.message);
    setEditing(null); setErr(""); after();
  };
  const remove = async (b: BundleRow) => { if (!confirm(`Remove ${b.name}?`)) return; await supabase.from("bundles").delete().eq("id", b.id); after(); };

  if (editing) return (
    <div className="glass max-w-2xl space-y-4 border border-border p-6">
      <h2 className="font-display text-2xl font-semibold uppercase">{editing.id ? "Edit bundle" : "New bundle"}</h2>
      <div><label className={label}>Name</label><input className={input} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
      <div><label className={label}>Bundle price (USD)</label><input className={input} type="number" min={0} value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
      <p className="text-sm">Pieces bought separately: <s className="text-muted-foreground">${sumOf(editing.product_ids)}</s> → bundle <b>${editing.price}</b>{sumOf(editing.product_ids) > editing.price && <span className="text-primary"> (saves ${sumOf(editing.product_ids) - editing.price})</span>}</p>
      <div>
        <label className={label}>Pieces</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {prods.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.product_ids.includes(p.id)} onChange={(e) => setEditing({ ...editing, product_ids: e.target.checked ? [...editing.product_ids, p.id] : editing.product_ids.filter((x) => x !== p.id) })} />
              {p.name} <span className="text-muted-foreground">${p.price}</span>
            </label>
          ))}
        </div>
      </div>
      {err && <p className="text-sm text-primary">{err}</p>}
      <div className="flex gap-3"><button onClick={save} className="btn btn-primary">Save</button><button onClick={() => { setEditing(null); setErr(""); }} className="btn btn-ghost">Cancel</button></div>
    </div>
  );
  return (
    <div>
      <button className="btn btn-primary mb-6" onClick={() => setEditing({ id: "", name: "", product_ids: [], price: 0, sort: rows.length + 1 })}>+ Add bundle</button>
      <div className="grid gap-3">
        {rows.map((b) => (
          <div key={b.id} className="glass flex items-center gap-4 border border-border p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium uppercase">{b.name} · <s className="text-muted-foreground">${sumOf(b.product_ids)}</s> <b>${b.price}</b></p>
              <p className="truncate text-xs text-muted-foreground">{b.product_ids.map((id) => prods.find((p) => p.id === id)?.name ?? id).join(" + ")}</p>
            </div>
            <button onClick={() => setEditing(b)} className="btn btn-ghost h-9 px-3 text-[10px]">Edit</button>
            <button onClick={() => remove(b)} className="btn btn-ghost h-9 px-3 text-[10px]">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUSES = ORDER_STATUSES.filter((s) => s !== "Canceled");

function OrdersTab() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState("All");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState("");
  const [savedId, setSavedId] = useState("");
  const load = async () => {
    setBusy(true);
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as OrderRow[]);
    setUpdated(new Date().toLocaleTimeString());
    setBusy(false);
  };
  useEffect(() => { load(); }, []);
  const norm = (s: string) => { const n = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); return n === "Delivered" ? "Completed" : n; };
  const quick = async (o: OrderRow, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", o.id);
    if (error) return alert(error.message);
    load();
  };
  const saveStatus = async (o: OrderRow) => {
    const status = drafts[o.id];
    if (!status) return;
    const { error } = await supabase.from("orders").update({ status }).eq("id", o.id);
    if (error) return alert(error.message);
    setDrafts((d) => { const n = { ...d }; delete n[o.id]; return n; });
    setSavedId(o.id); setTimeout(() => setSavedId(""), 2000);
    load();
  };
  const removeOrder = async (o: OrderRow) => {
    if (!confirm(`Delete order ${o.order_code} forever?`)) return;
    const { error } = await supabase.from("orders").delete().eq("id", o.id);
    if (error) return alert(error.message);
    load();
  };
  const active = rows.filter((o) => norm(o.status) !== "Archived");
  const archived = rows.filter((o) => norm(o.status) === "Archived");
  const shown = filter === "Archived" ? archived : filter === "All" ? active : active.filter((o) => norm(o.status) === filter);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {["All", ...STATUSES, "Canceled", "Archived"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`btn h-9 px-3 text-[10px] ${filter === s ? "btn-primary" : "btn-ghost"}`}>
            {s === "Canceled" ? "Canceled by customer" : s} ({s === "All" ? active.length : rows.filter((o) => norm(o.status) === s).length})
          </button>
        ))}
        <button onClick={load} disabled={busy} className="btn btn-primary h-9 px-3 text-[10px]">{busy ? "Refreshing…" : "↻ Refresh orders"}</button>
        {updated && <span className="text-xs text-muted-foreground">Last checked {updated}</span>}
      </div>
      {shown.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
      <div className="grid gap-3">
        {shown.map((o) => {
          const all = Array.isArray(o.items) ? (o.items as { kind: string; image?: string }[]) : [];
          const receipt = all.find((x) => x.kind === "receipt")?.image;
          const items = Array.isArray(o.items) ? (all.filter((x) => x.kind !== "receipt") as { kind: string; qty: number; unitPrice: number; pieces: { name: string; size: string; color: string }[] }[]) : [];
          const current = drafts[o.id] ?? norm(o.status);
          const dirty = drafts[o.id] && drafts[o.id] !== norm(o.status);
          return (
            <div key={o.id} className="glass border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{o.order_code} · ${o.total}</p>
                  <p className="text-xs text-muted-foreground">Ordered {new Date(o.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
                  <div className="mt-2"><StatusBadge s={norm(o.status)} /></div>
                  {norm(o.status) === "Canceled" && <p className="mt-1 text-xs font-semibold text-destructive">Customer canceled this order — refund needed</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                {norm(o.status) === "Pending" && <>
                  <button onClick={() => quick(o, "Confirmed")} className="btn btn-ghost h-9 px-3 text-[10px]">✓ Confirm</button>
                  <button onClick={() => quick(o, "Declined")} className="btn h-9 bg-red-600 px-3 text-[10px] text-white">✕ Decline</button>
                </>}
                <select value={current} onChange={(e) => setDrafts((d) => ({ ...d, [o.id]: e.target.value }))} className="h-9 border border-border bg-background px-2 text-sm">
                  {current === "Canceled" && <option value="Canceled" disabled>Canceled by customer</option>}
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                {dirty && <button onClick={() => saveStatus(o)} className="btn btn-primary h-9 px-3 text-[10px]">Save</button>}
                {savedId === o.id && <span className="text-xs text-primary">Saved ✓</span>}
                {norm(o.status) === "Archived"
                  ? <button onClick={() => quick(o, "Pending")} className="btn btn-ghost h-9 px-3 text-[10px]">Unarchive</button>
                  : <button onClick={() => quick(o, "Archived")} className="btn btn-ghost h-9 px-3 text-[10px]">Archive</button>}
                <button onClick={() => removeOrder(o)} className="btn btn-ghost h-9 px-3 text-[10px] text-destructive">Delete</button>
                </div>
              </div>
              <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Name:</span> {o.name}</p>
                <p><span className="text-muted-foreground">Phone:</span> <a className="underline" href={`https://wa.me/${o.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">{o.phone}</a></p>
                <p><span className="text-muted-foreground">Governorate:</span> {o.governorate}</p>
                <p><span className="text-muted-foreground">Address:</span> {o.address}</p>
                {o.notes && <p className="sm:col-span-2"><span className="text-muted-foreground">Notes:</span> {o.notes}</p>}
              </div>
              {receipt ? <a href={receipt} target="_blank" rel="noopener noreferrer" className="mt-3 block"><img src={receipt} alt="Payment receipt" className="max-h-40 border border-border" /><span className="text-xs underline">Payment receipt — open full</span></a> : <p className="mt-3 text-xs text-destructive">No receipt uploaded</p>}
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                {items.map((it, i) => (
                  <li key={i}>{it.qty} × {it.pieces.map((pc) => `${pc.name} (${[pc.color, pc.size].filter(Boolean).join(", ")})`).join(" + ")} — ${it.unitPrice * it.qty}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
