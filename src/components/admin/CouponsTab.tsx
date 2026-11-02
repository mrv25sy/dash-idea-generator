import { useEffect, useState } from "react";
import { storeClient } from "@/lib/store-client";
import { parseIds, type Coupon } from "@/lib/coupons";

const input = "h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-primary";
const label = "nav-link mb-1 block";
const CATS = [["tee", "T-shirts"], ["hoodie", "Hoodies"], ["cap", "Caps"], ["bundle", "Bundles"]] as const;
const blank: Coupon = { code: "", type: "percent", value: 10, active: true, categories: [], customerIds: [] };
const toLocal = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

export function CouponsTab() {
  const [list, setList] = useState<Coupon[]>([]);
  const [f, setF] = useState<Coupon>(blank);
  const [ids, setIds] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    storeClient.from("store_settings").select("value").eq("key", "coupons_json").maybeSingle().then(({ data }) => {
      try { setList(data?.value ? JSON.parse(data.value) : []); } catch { setList([]); }
    });
  }, []);
  const persist = async (next: Coupon[]) => {
    const { error } = await storeClient.from("store_settings").upsert({ key: "coupons_json", value: JSON.stringify(next), updated_at: new Date().toISOString() });
    if (error) return setMsg("Couldn't save: " + error.message);
    setList(next); setMsg("Saved ✓");
  };
  const save = () => {
    const code = f.code.trim().toUpperCase().replace(/\s/g, "");
    if (!code) return setMsg("Type a code first.");
    if (!(f.value > 0)) return setMsg("Discount must be more than 0.");
    if (list.some((c) => c.code === code && c.code !== editing)) return setMsg("That code already exists.");
    const c: Coupon = { ...f, code, customerIds: parseIds(ids) };
    void persist(editing ? list.map((x) => (x.code === editing ? c : x)) : [c, ...list]);
    setF(blank); setIds(""); setEditing(null);
  };
  const set = <K extends keyof Coupon>(k: K, v: Coupon[K]) => setF((x) => ({ ...x, [k]: v }));
  const describe = (c: Coupon) => [
    c.type === "percent" ? `${c.value}% off` : `${c.value} off`,
    c.categories?.length ? CATS.filter(([k]) => c.categories!.includes(k)).map(([, l]) => l).join(", ") + " only" : "all products",
    c.minItems ? `${c.minItems}+ items` : "", c.minSpend ? `min spend ${c.minSpend}` : "",
    c.oncePerCustomer ? "once per customer" : "",
    c.customerIds?.length ? `only ${c.customerIds.map((i) => "#" + i).join(", ")}` : "",
    c.startsAt ? `from ${new Date(c.startsAt).toLocaleString()}` : "", c.endsAt ? `until ${new Date(c.endsAt).toLocaleString()}` : "",
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-8">
      <div className="space-y-4 border border-border p-4 sm:p-5">
        <h2 className="nav-link">{editing ? `Edit ${editing}` : "New coupon"}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><span className={label}>Code</span><input className={input} placeholder="VIP20" value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} /></div>
          <div><span className={label}>Type</span>
            <select className={input} value={f.type} onChange={(e) => set("type", e.target.value as Coupon["type"])}><option value="percent">% off</option><option value="fixed">Fixed amount off</option></select></div>
          <div><span className={label}>Discount</span><input className={input} type="number" min={0} value={f.value} onChange={(e) => set("value", Number(e.target.value))} /></div>
          <div><span className={label}>Starts (optional)</span><input className={input} type="datetime-local" value={toLocal(f.startsAt)} onChange={(e) => set("startsAt", e.target.value ? new Date(e.target.value).toISOString() : undefined)} /></div>
          <div><span className={label}>Ends (optional)</span><input className={input} type="datetime-local" value={toLocal(f.endsAt)} onChange={(e) => set("endsAt", e.target.value ? new Date(e.target.value).toISOString() : undefined)} /></div>
          <div><span className={label}>Min. items in cart</span><input className={input} type="number" min={0} placeholder="e.g. 2" value={f.minItems ?? ""} onChange={(e) => set("minItems", e.target.value ? Number(e.target.value) : undefined)} /></div>
          <div><span className={label}>Min. spend</span><input className={input} type="number" min={0} placeholder="optional" value={f.minSpend ?? ""} onChange={(e) => set("minSpend", e.target.value ? Number(e.target.value) : undefined)} /></div>
          <div className="sm:col-span-2"><span className={label}>Only for customer numbers (optional)</span><input className={input} placeholder="#48213, #10422 — empty = everyone" value={ids} onChange={(e) => setIds(e.target.value)} /></div>
        </div>
        <div>
          <span className={label}>Works on (none ticked = all products)</span>
          <div className="flex flex-wrap gap-2">
            {CATS.map(([k, l]) => {
              const on = f.categories?.includes(k);
              return <button key={k} type="button" onClick={() => set("categories", on ? f.categories!.filter((x) => x !== k) : [...(f.categories ?? []), k])} className={`btn h-9 px-3 text-[10px] ${on ? "btn-primary" : "btn-ghost"}`}>{l}</button>;
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.oncePerCustomer} onChange={(e) => set("oncePerCustomer", e.target.checked)} /> Use once per customer (needs sign-in)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} className="btn btn-primary h-10">{editing ? "Save coupon" : "Create coupon"}</button>
          {editing && <button onClick={() => { setEditing(null); setF(blank); setIds(""); }} className="btn btn-ghost h-10">Cancel</button>}
          <span className="text-sm text-muted-foreground">{msg}</span>
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="nav-link">Coupons ({list.length})</h2>
        {list.length === 0 && <p className="text-sm text-muted-foreground">No coupons yet.</p>}
        {list.map((c) => {
          const expired = c.endsAt && new Date(c.endsAt) < new Date();
          return (
            <div key={c.code} className={`flex flex-wrap items-start justify-between gap-3 border border-border p-4 ${!c.active || expired ? "opacity-60" : ""}`}>
              <div className="min-w-0 break-words">
                <p className="font-mono text-lg font-bold">{c.code} <span className="ml-2 font-sans text-[10px] uppercase text-muted-foreground">{!c.active ? "Off" : expired ? "Expired" : "Active"}</span></p>
                <p className="text-xs text-muted-foreground">{describe(c)}</p>
              </div>
              <div className="flex gap-3 text-sm">
                <button className="underline" onClick={() => { setEditing(c.code); setF(c); setIds((c.customerIds ?? []).map((i) => "#" + i).join(", ")); }}>Edit</button>
                <button className="underline" onClick={() => persist(list.map((x) => (x.code === c.code ? { ...x, active: !x.active } : x)))}>{c.active ? "Turn off" : "Turn on"}</button>
                <button className="text-destructive underline" onClick={() => confirm(`Delete ${c.code}?`) && persist(list.filter((x) => x.code !== c.code))}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
