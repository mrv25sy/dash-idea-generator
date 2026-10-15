import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { storeClient } from "@/lib/store-client";
import { dropClosed, loadCatalog, resolveImage, type CustomSection, type Drop } from "@/data/products";

const input = "h-11 w-full border border-border bg-background px-3 text-sm outline-none focus:border-primary";
const label = "nav-link mb-1 block";
type P = { id: string; name: string; type: string; drop_name: string | null; images: string[] };

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await storeClient.from("store_settings").select("value").eq("key", key).maybeSingle();
  try { return data?.value ? (JSON.parse(data.value) as T) : fallback; } catch { return fallback; }
}
async function writeSetting(key: string, value: unknown) {
  const { error } = await storeClient.from("store_settings").upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
  if (!error) await loadCatalog(true);
  return error?.message ?? "";
}
function useProducts() {
  const [rows, setRows] = useState<P[]>([]);
  const load = async () => {
    const { data } = await supabase.from("products").select("id,name,type,drop_name,images").order("sort");
    setRows((data ?? []) as P[]);
  };
  useEffect(() => { load(); }, []);
  return { rows, load };
}
/** Toggle a product into (or out of) a drop or a custom section. */
async function assign(p: P, on: boolean, target: { drop?: string; section?: string }) {
  const patch = on
    ? target.drop ? { type: "drop", drop_name: target.drop } : { type: `section:${target.section}`, drop_name: null }
    : { type: "single", drop_name: null };
  await supabase.from("products").update(patch).eq("id", p.id);
}
function ProductPicker({ rows, isIn, onToggle }: { rows: P[]; isIn: (p: P) => boolean; onToggle: (p: P, on: boolean) => void }) {
  return (
    <div className="grid max-h-72 gap-1 overflow-y-auto border border-border p-2 sm:grid-cols-2">
      {rows.map((p) => (
        <label key={p.id} className="flex cursor-pointer items-center gap-2 p-1 text-xs">
          <input type="checkbox" checked={isIn(p)} onChange={(e) => onToggle(p, e.target.checked)} />
          <img src={resolveImage(p.images[0] ?? "")} alt="" className="h-8 w-7 object-cover" />
          <span className="truncate uppercase">{p.name}</span>
        </label>
      ))}
    </div>
  );
}

const toLocal = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export function DropsTab() {
  const [list, setList] = useState<Drop[] | null>(null);
  const [edit, setEdit] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const { rows, load } = useProducts();
  useEffect(() => { readSetting<Drop[]>("drops_json", []).then(setList); }, []);
  if (!list) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const save = async (next: Drop[]) => { setBusy(true); setMsg((await writeSetting("drops_json", next)) || "Saved."); setList(next); setBusy(false); };
  const upd = (i: number, patch: Partial<Drop>) => setList(list.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const upload = async (i: number, f?: File) => {
    if (!f) return;
    setBusy(true);
    const path = `drops/${Date.now()}.${f.name.split(".").pop()}`;
    const up = await supabase.storage.from("product-images").upload(path, f, { contentType: f.type });
    if (up.error) { setMsg(up.error.message); setBusy(false); return; }
    const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (data?.signedUrl) upd(i, { cover: data.signedUrl });
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <button className="btn btn-primary" onClick={() => { setList([...list, { name: "New drop", tagline: "", cover: "", endsAt: null, archived: false }]); setEdit(list.length); }}>+ Add drop</button>
      {list.length === 0 && <p className="text-sm text-muted-foreground">No drops saved yet — the site is showing the sample drops. Add your first drop to replace them.</p>}
      {list.map((d, i) => (
        <div key={i} className="glass border border-border p-4">
          <div className="flex flex-wrap items-center gap-4">
            {d.cover ? <img src={resolveImage(d.cover)} alt="" className={`h-20 w-16 object-cover ${dropClosed(d) ? "blur-[2px]" : ""}`} /> : <div className="h-20 w-16 border border-dashed border-border" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium uppercase">{d.name}</p>
              <p className="text-xs text-muted-foreground">
                {d.archived ? "Archived (hidden)" : dropClosed(d) ? "Closed (blurred)" : d.endsAt ? `Closes ${new Date(d.endsAt).toLocaleString()}` : "Live, no timer"}
                {" · "}{rows.filter((p) => p.type === "drop" && p.drop_name === d.name).length} products
              </p>
            </div>
            <button className="btn btn-ghost h-9 px-3 text-[10px]" onClick={() => setEdit(edit === i ? null : i)}>{edit === i ? "Close" : "Edit"}</button>
            <button className="btn btn-ghost h-9 px-3 text-[10px]" onClick={() => save(list.map((x, j) => (j === i ? { ...x, archived: !x.archived } : x)))}>{d.archived ? "Unarchive" : "Archive"}</button>
            <button className="btn btn-ghost h-9 px-3 text-[10px]" onClick={() => confirm(`Delete ${d.name}?`) && save(list.filter((_, j) => j !== i))}>Delete</button>
          </div>
          {edit === i && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div><label className={label}>Drop name</label><input className={input} value={d.name} onChange={(e) => upd(i, { name: e.target.value })} /></div>
              <div><label className={label}>Tagline</label><input className={input} value={d.tagline} onChange={(e) => upd(i, { tagline: e.target.value })} /></div>
              <div><label className={label}>Cover picture</label><input type="file" accept="image/*" className="text-sm" onChange={(e) => upload(i, e.target.files?.[0])} /></div>
              <div><label className={label}>Closes at (leave empty for no timer)</label>
                <div className="flex gap-2">
                  <input type="datetime-local" className={input} value={toLocal(d.endsAt)} onChange={(e) => upd(i, { endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                  <button type="button" className="btn btn-ghost h-11 shrink-0" onClick={() => upd(i, { endsAt: null })}>Clear</button>
                </div>
              </div>
              <div className="md:col-span-2"><label className={label}>Drop products (tick to add to this drop)</label>
                <ProductPicker rows={rows} isIn={(p) => p.type === "drop" && p.drop_name === d.name} onToggle={async (p, on) => { await assign(p, on, { drop: d.name }); await load(); await loadCatalog(true); }} />
                <p className="mt-1 text-[10px] text-muted-foreground">To upload a brand-new drop product, add it in Designs and choose type "drop" with this drop name.</p>
              </div>
              <button disabled={busy} className="btn btn-primary md:col-span-2" onClick={() => save(list)}>Save drop</button>
            </div>
          )}
        </div>
      ))}
      {msg && <p className="text-sm text-primary">{msg}</p>}
    </div>
  );
}

export function SectionsTab() {
  const [list, setList] = useState<CustomSection[] | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const { rows, load } = useProducts();
  useEffect(() => { readSetting<CustomSection[]>("sections_json", []).then(setList); }, []);
  if (!list) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const save = async (next: CustomSection[]) => { setList(next); setMsg((await writeSetting("sections_json", next)) || "Saved."); };
  const move = (i: number, d: number) => { const n = [...list]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j]!, n[i]!]; save(n); };
  const upd = (i: number, patch: Partial<CustomSection>) => { setMsg(""); setList(list.map((x, j) => (j === i ? { ...x, ...patch } : x))); };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Drops, Singles and Get the Fit (bundles) are built in. Add extra homepage sections here.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = name.trim(); if (!v || list.some((s) => s.name === v)) return; save([...list, { name: v, showInNav: true }]); setName(""); }}>
        <input className={input} value={name} placeholder="Section name, e.g. Summer Picks" onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary h-11 shrink-0">+ Add section</button>
      </form>
      {list.map((s, i) => (
        <details key={s.name} className="glass border border-border p-4">
          <summary className="flex cursor-pointer flex-wrap items-center gap-3">
            <span className="flex-1 font-medium uppercase">{s.name} <span className="text-xs normal-case text-muted-foreground">· {rows.filter((p) => p.type === `section:${s.name}`).length} products</span></span>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={s.showInNav} onChange={(e) => save(list.map((x, j) => (j === i ? { ...x, showInNav: e.target.checked } : x)))} /> In menu</label>
            <button type="button" className="btn btn-ghost h-8 px-2 text-[10px]" onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="btn btn-ghost h-8 px-2 text-[10px]" onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="btn btn-ghost h-8 px-3 text-[10px]" onClick={() => confirm(`Remove section ${s.name}?`) && save(list.filter((_, j) => j !== i))}>Remove</button>
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div><label className={label}>Small top label (optional)</label><input className={input} value={s.eyebrow ?? ""} placeholder="e.g. Limited" onChange={(e) => upd(i, { eyebrow: e.target.value })} /></div>
            <div><label className={label}>Title shown on website</label><input className={input} value={s.title ?? ""} placeholder={s.name} onChange={(e) => upd(i, { title: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={label}>Description (optional, can be long)</label>
              <textarea className={`${input} h-auto min-h-28 py-2`} value={s.description ?? ""} placeholder="Tell customers about this section…" onChange={(e) => upd(i, { description: e.target.value })} />
            </div>
            <div className="md:col-span-2"><label className={label}>Products in this section (tick to add)</label>
              <ProductPicker rows={rows} isIn={(p) => p.type === `section:${s.name}`} onToggle={async (p, on) => { await assign(p, on, { section: s.name }); await load(); await loadCatalog(true); }} />
            </div>
            <button type="button" className="btn btn-primary md:col-span-2" onClick={() => save(list)}>Save section</button>
          </div>
        </details>
      ))}
      {msg && <p className="text-sm text-primary">{msg}</p>}
    </div>
  );
}

export function BannersTab() {
  const [list, setList] = useState<string[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    storeClient.from("store_settings").select("value").eq("key", "banners_json").maybeSingle().then(({ data }) => {
      try { setList(data?.value != null ? (JSON.parse(data.value) as string[]) : ["asset:crew"]); } catch { setList(["asset:crew"]); }
    });
  }, []);
  if (!list) return <p className="text-sm text-muted-foreground">Loading…</p>;
  // Changes are staged locally; the website only updates when "Save changes" is pressed.
  const stage = (next: string[]) => { setList(next); setDirty(true); setMsg(""); };
  const save = async () => { setBusy(true); const err = await writeSetting("banners_json", list); setMsg(err || "Saved — website updated."); if (!err) setDirty(false); setBusy(false); };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const added: string[] = [];
    for (const f of Array.from(files)) {
      const path = `banners/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${f.name.split(".").pop()}`;
      const up = await supabase.storage.from("product-images").upload(path, f, { contentType: f.type });
      if (up.error) { setMsg(up.error.message); continue; }
      const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (data?.signedUrl) added.push(data.signedUrl);
    }
    setBusy(false);
    stage([...list, ...added]);
  };
  const move = (i: number, d: number) => { const n = [...list]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j]!, n[i]!]; stage(n); };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Full-width photos shown between Drops and Singles. More than one photo slides every 5 seconds. Remove all photos to hide the section. Best size: wide banner (about 2.7 : 1).</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn btn-ghost inline-flex cursor-pointer">{busy ? "Uploading…" : "+ Add photos"}<input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} /></label>
        <button className="btn btn-primary disabled:opacity-50" disabled={busy || !dirty} onClick={save}>Save changes</button>
        {dirty && <span className="text-xs text-primary">Unsaved changes</span>}
      </div>
      {list.length === 0 && <p className="text-sm text-muted-foreground">No photos — the banner section will be hidden on the website after you save.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((src, i) => (
          <div key={src + i} className="glass border border-border p-2">
            <img src={resolveImage(src)} alt="" className="aspect-[2.7/1] w-full object-cover" />
            <div className="mt-2 flex gap-2">
              <button className="btn btn-ghost h-8 px-2 text-[10px]" onClick={() => move(i, -1)}>↑</button>
              <button className="btn btn-ghost h-8 px-2 text-[10px]" onClick={() => move(i, 1)}>↓</button>
              <button className="btn btn-ghost ml-auto h-8 px-3 text-[10px]" onClick={() => stage(list.filter((_, j) => j !== i))}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {msg && <p className="text-sm text-primary">{msg}</p>}
    </div>
  );
}
