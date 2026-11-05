import { useState } from "react";
import { supabase } from "@/lib/store-client";
import { imageName, resolveImage, withImageName, type Color } from "@/data/products";

const ANGLES = ["Front", "Back", "Left", "Right", "Close-up"];

const input = "h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-primary";

/** Per-color editor: name, swatch, own photos, and pieces per size for that color. */
export function ColorsEditor({ colors, sizes, onChange }: { colors: Color[]; sizes: string[]; onChange: (c: Color[]) => void }) {
  const [busy, setBusy] = useState(-1);
  const upd = (i: number, patch: Partial<Color>) => onChange(colors.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= colors.length) return;
    const next = [...colors];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const moveImg = (i: number, k: number, d: number) => {
    const imgs = [...(colors[i]?.images ?? [])];
    const j = k + d;
    if (j < 0 || j >= imgs.length) return;
    [imgs[k], imgs[j]] = [imgs[j]!, imgs[k]!];
    upd(i, { images: imgs });
  };
  const setCover = (i: number) => onChange(colors.map((c, j) => ({ ...c, cover: j === i ? true : undefined })));
  const nameImg = (i: number, k: number, name: string) => upd(i, { images: (colors[i]?.images ?? []).map((x, j) => (j === k ? withImageName(x, name) : x)) });
  const upload = async (i: number, files: FileList | null) => {
    if (!files?.length) return;
    setBusy(i);
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${f.name.split(".").pop()}`;
      const up = await supabase.storage.from("product-images").upload(path, f, { contentType: f.type });
      if (up.error) continue;
      const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (data?.signedUrl) urls.push(data.signedUrl);
    }
    upd(i, { images: [...(colors[i]?.images ?? []), ...urls] });
    setBusy(-1);
  };
  return (
    <div className="space-y-3">
      {colors.map((c, i) => (
        <div key={i} className="space-y-3 border border-border p-3">
          <div className="flex items-center gap-2">
            <input type="color" value={c.hex} onChange={(e) => upd(i, { hex: e.target.value })} className="h-10 w-12 shrink-0 cursor-pointer border border-border bg-background" aria-label="Swatch" />
            <input className={input} value={c.name} placeholder="Color name" onChange={(e) => upd(i, { name: e.target.value })} />
            <label className="flex shrink-0 items-center gap-1 text-xs" title="Photo shown on the product card"><input type="radio" name="cover-color" checked={c.cover ? true : !colors.some((x) => x.cover) && i === 0} onChange={() => setCover(i)} /> Cover</label>
            <label className="flex shrink-0 items-center gap-1 text-xs"><input type="checkbox" checked={!!c.soldOut} onChange={(e) => upd(i, { soldOut: e.target.checked })} /> Sold out</label>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="btn btn-ghost h-10 shrink-0 px-2 disabled:opacity-30">↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === colors.length - 1} aria-label="Move down" className="btn btn-ghost h-10 shrink-0 px-2 disabled:opacity-30">↓</button>
            <button type="button" onClick={() => onChange(colors.filter((_, j) => j !== i))} className="btn btn-ghost h-10 shrink-0">×</button>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Photos for this color (first photo = card photo; tag each angle so customers see Front, Back, Close-up…)</p>
            <div className="flex flex-wrap gap-2">
              {(c.images ?? []).map((src, k) => (
                <div key={k} className="w-28">
                  <div className="relative">
                    <img src={resolveImage(src)} alt="" className="h-32 w-28 object-cover" />
                    <button type="button" onClick={() => upd(i, { images: c.images!.filter((_, j) => j !== k) })} className="absolute right-0 top-0 bg-primary px-1 text-xs text-primary-foreground">×</button>
                    {k === 0 && <span className="absolute bottom-0 left-0 bg-background/80 px-1 text-[9px] uppercase">Card photo</span>}
                  </div>
                  <div className="mt-1 flex gap-1">
                    <button type="button" onClick={() => moveImg(i, k, -1)} disabled={k === 0} aria-label="Move photo left" className="btn btn-ghost h-6 flex-1 px-0 text-xs disabled:opacity-30">←</button>
                    <button type="button" onClick={() => moveImg(i, k, 1)} disabled={k === (c.images?.length ?? 0) - 1} aria-label="Move photo right" className="btn btn-ghost h-6 flex-1 px-0 text-xs disabled:opacity-30">→</button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ANGLES.map((a) => (
                      <button key={a} type="button" onClick={() => nameImg(i, k, imageName(src) === a ? "" : a)} className={`border px-1 text-[9px] uppercase ${imageName(src) === a ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{a}</button>
                    ))}
                  </div>
                  <input className="mt-1 h-7 w-full border border-border bg-background px-1 text-[11px] outline-none focus:border-primary" placeholder="Custom name" value={imageName(src)} onChange={(e) => nameImg(i, k, e.target.value)} />
                </div>
              ))}
              <label className={`btn btn-ghost h-20 cursor-pointer border-dashed text-[10px] ${busy === i ? "pointer-events-none opacity-60" : ""}`}>
                {busy === i ? "Uploading…" : "+ Photos"}
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void upload(i, e.target.files); e.target.value = ""; }} />
              </label>
            </div>
          </div>
          {sizes.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Pieces per size in this color (empty = use the design's stock)</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((sz) => (
                  <div key={sz} className="w-16">
                    <span className="block text-[10px] font-semibold uppercase">{sz}</span>
                    <input className={input} type="number" min={0} placeholder="–" value={c.sizeStock?.[sz] ?? ""} onChange={(e) => {
                      const ss = { ...(c.sizeStock ?? {}) };
                      if (e.target.value === "") delete ss[sz]; else ss[sz] = Math.max(0, Math.floor(Number(e.target.value)));
                      upd(i, { sizeStock: Object.keys(ss).length ? ss : undefined });
                    }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...colors, { name: "", hex: "#0d0d0d" }])} className="btn btn-ghost h-9 text-[10px]">+ Add color</button>
    </div>
  );
}
