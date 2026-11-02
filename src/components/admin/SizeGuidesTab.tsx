import { useEffect, useState } from "react";
import { supabase } from "@/lib/store-client";
import { loadSizeGuides, saveSizeGuides, type SizeGuide } from "@/lib/size-guides";

const input = "h-10 w-full min-w-0 border border-border bg-background px-2 text-sm outline-none focus:border-primary";
const label = "nav-link mb-1 block";
const PRESET_CATS = ["hoodie", "tee", "oversized tee", "pants", "cap"];

const blank = (): SizeGuide => ({
  id: crypto.randomUUID(), name: "New guide", category: "", productIds: [],
  columns: ["Chest width", "Length"], rows: ["S", "M", "L", "XL"].map((size) => ({ size, values: ["", ""] })),
  fitNote: "", howToMeasure: "",
});

export function SizeGuidesTab() {
  const [guides, setGuides] = useState<SizeGuide[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; category: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadSizeGuides().then(setGuides);
    supabase.from("products").select("id,name,category").order("sort").then(({ data }) => setProducts((data ?? []) as typeof products));
  }, []);

  const upd = (i: number, fn: (g: SizeGuide) => SizeGuide) => { setGuides((gs) => gs.map((g, j) => (j === i ? fn(g) : g))); setDirty(true); };
  const save = async () => { const e = await saveSizeGuides(guides); setMsg(e || "Saved ✓"); if (!e) setDirty(false); setTimeout(() => setMsg(""), 2500); };
  const cats = Array.from(new Set([...PRESET_CATS, ...products.map((p) => p.category)])).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">All sizes in cm. A guide picked for a specific design wins over its category guide. A guide with no category and no designs is used for everything else.</p>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-primary">{msg}</span>}
          <button onClick={() => { setGuides((g) => [...g, blank()]); setDirty(true); }} className="btn btn-ghost h-10">+ New guide</button>
          <button onClick={save} disabled={!dirty} className="btn btn-primary h-10 disabled:opacity-50">Save changes</button>
        </div>
      </div>

      {guides.map((g, i) => (
        <div key={g.id} className="glass space-y-4 border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label}>Guide name</label><input className={input} value={g.name} onChange={(e) => upd(i, (x) => ({ ...x, name: e.target.value }))} /></div>
            <div><label className={label}>Default for category</label>
              <input className={input} list={`cats-${g.id}`} value={g.category} placeholder="e.g. hoodie, pants… or leave empty" onChange={(e) => upd(i, (x) => ({ ...x, category: e.target.value.trim().toLowerCase() }))} />
              <datalist id={`cats-${g.id}`}>{cats.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead><tr>
                <th className="w-20 py-1 text-left text-xs text-muted-foreground">Size</th>
                {g.columns.map((c, ci) => (
                  <th key={ci} className="px-1 py-1">
                    <div className="flex gap-1">
                      <input className={input} value={c} onChange={(e) => upd(i, (x) => ({ ...x, columns: x.columns.map((cc, k) => (k === ci ? e.target.value : cc)) }))} />
                      <button aria-label="Remove column" onClick={() => upd(i, (x) => ({ ...x, columns: x.columns.filter((_, k) => k !== ci), rows: x.rows.map((r) => ({ ...r, values: r.values.filter((_, k) => k !== ci) })) }))} className="btn btn-ghost h-10 px-2">×</button>
                    </div>
                  </th>
                ))}
                <th className="w-10" />
              </tr></thead>
              <tbody>
                {g.rows.map((r, ri) => (
                  <tr key={ri}>
                    <td className="py-1 pr-1"><input className={input} value={r.size} onChange={(e) => upd(i, (x) => ({ ...x, rows: x.rows.map((rr, k) => (k === ri ? { ...rr, size: e.target.value } : rr)) }))} /></td>
                    {g.columns.map((_, ci) => (
                      <td key={ci} className="px-1 py-1"><input className={input} inputMode="decimal" placeholder="cm" value={r.values[ci] ?? ""} onChange={(e) => upd(i, (x) => ({ ...x, rows: x.rows.map((rr, k) => { if (k !== ri) return rr; const v = [...rr.values]; v[ci] = e.target.value; return { ...rr, values: v }; }) }))} /></td>
                    ))}
                    <td><button aria-label="Remove size" onClick={() => upd(i, (x) => ({ ...x, rows: x.rows.filter((_, k) => k !== ri) }))} className="btn btn-ghost h-10 px-2">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => upd(i, (x) => ({ ...x, rows: [...x.rows, { size: "", values: x.columns.map(() => "") }] }))} className="btn btn-ghost h-9 text-[10px]">+ Add size</button>
            <button onClick={() => upd(i, (x) => ({ ...x, columns: [...x.columns, "New measure"], rows: x.rows.map((r) => ({ ...r, values: [...r.values, ""] })) }))} className="btn btn-ghost h-9 text-[10px]">+ Add measurement</button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label}>Fit & model note</label><textarea className={`${input} h-20 py-2`} placeholder="Boxy oversized cut. Model is 182 cm and wears L." value={g.fitNote ?? ""} onChange={(e) => upd(i, (x) => ({ ...x, fitNote: e.target.value }))} /></div>
            <div><label className={label}>How to measure</label><textarea className={`${input} h-20 py-2`} placeholder="Chest: flat, armpit to armpit. Length: shoulder to hem." value={g.howToMeasure ?? ""} onChange={(e) => upd(i, (x) => ({ ...x, howToMeasure: e.target.value }))} /></div>
          </div>

          <div>
            <label className={label}>Use for these designs (overrides their category guide)</label>
            <div className="flex flex-wrap gap-2">
              {products.map((p) => {
                const on = g.productIds.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => setGuides((gs) => { setDirty(true); return gs.map((x, j) => ({ ...x, productIds: j === i ? (on ? x.productIds.filter((id) => id !== p.id) : [...x.productIds, p.id]) : x.productIds.filter((id) => on || id !== p.id) })); })}
                    className={`h-8 border px-3 text-xs font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{p.name}</button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => { if (confirm(`Delete "${g.name}"?`)) { setGuides((gs) => gs.filter((_, j) => j !== i)); setDirty(true); } }} className="btn btn-ghost h-9 text-[10px] text-destructive">Delete guide</button>
          </div>
        </div>
      ))}
      {!guides.length && <p className="text-sm text-muted-foreground">No guides yet — the Size guide link is hidden on all products.</p>}
    </div>
  );
}
