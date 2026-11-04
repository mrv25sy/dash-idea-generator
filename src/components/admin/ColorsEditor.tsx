import { useState } from "react";
import { supabase } from "@/lib/store-client";
import { resolveImage, type Color } from "@/data/products";

const input = "h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-primary";

/** Per-color editor: name, swatch, own photos, and pieces per size for that color. */
export function ColorsEditor({ colors, sizes, onChange }: { colors: Color[]; sizes: string[]; onChange: (c: Color[]) => void }) {
  const [busy, setBusy] = useState(-1);
  const upd = (i: number, patch: Partial<Color>) => onChange(colors.map((c, j) => (j === i ? { ...c, ...patch } : c)));
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
            <label className="flex shrink-0 items-center gap-1 text-xs"><input type="checkbox" checked={!!c.soldOut} onChange={(e) => upd(i, { soldOut: e.target.checked })} /> Sold out</label>
            <button type="button" onClick={() => onChange(colors.filter((_, j) => j !== i))} className="btn btn-ghost h-10 shrink-0">×</button>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Photos for this color (shown when the customer picks it; empty = main photos)</p>
            <div className="flex flex-wrap gap-2">
              {(c.images ?? []).map((src, k) => (
                <div key={k} className="relative">
                  <img src={resolveImage(src)} alt="" className="h-20 w-16 object-cover" />
                  <button type="button" onClick={() => upd(i, { images: c.images!.filter((_, j) => j !== k) })} className="absolute right-0 top-0 bg-primary px-1 text-xs text-primary-foreground">×</button>
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
