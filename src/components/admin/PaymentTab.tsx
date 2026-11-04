import { useEffect, useState } from "react";
import { fileToCompactDataUrl, loadPaymentSettings, savePaymentSettings, type PaymentSettings } from "@/lib/store-settings";

const input = "h-11 w-full border border-border bg-background px-3 text-sm outline-none focus:border-primary";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

/** Full control of the checkout payment section: up to several methods, each with its own QR, name, ID and note. */
export function PaymentTab() {
  const [s, setS] = useState<PaymentSettings | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void loadPaymentSettings().then(setS); }, []);
  if (!s) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const upd = (i: number, patch: Partial<PaymentSettings["methods"][number]>) => setS({ ...s, methods: s.methods.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const save = async () => {
    setBusy(true); setMsg("");
    const err = await savePaymentSettings({ ...s, methods: s.methods.filter((m) => m.name.trim() || m.address.trim()) });
    setBusy(false); setMsg(err ? `Error: ${err}` : "Saved. Checkout shows this now.");
  };
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <label className={label}>Text above the payment details (optional)</label>
        <textarea className={`${input} h-20 py-2`} value={s.header} placeholder="e.g. Send the exact amount, then upload a screenshot." onChange={(e) => setS({ ...s, header: e.target.value })} />
      </div>
      {s.methods.map((m, i) => (
        <div key={i} className="space-y-3 border border-border p-4">
          <div className="flex items-center justify-between">
            <p className="nav-link">Payment method {i + 1}</p>
            {s.methods.length > 1 && <button type="button" className="btn btn-ghost h-8 text-[10px]" onClick={() => setS({ ...s, methods: s.methods.filter((_, j) => j !== i) })}>Remove</button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label}>Method name (tab title)</label><input className={input} value={m.label} placeholder="Sham Cash" onChange={(e) => upd(i, { label: e.target.value })} /></div>
            <div><label className={label}>Recipient name</label><input className={input} value={m.name} onChange={(e) => upd(i, { name: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className={label}>Payment ID / number</label><input className={input} value={m.address} onChange={(e) => upd(i, { address: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className={label}>Note for this method (optional)</label><input className={input} value={m.note} onChange={(e) => upd(i, { note: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-4">
            {m.qr ? <img src={m.qr} alt="QR" className="w-28 border border-border bg-background p-1" /> : <div className="grid h-28 w-28 place-items-center border border-dashed border-border text-xs text-muted-foreground">No QR</div>}
            <div className="flex flex-col gap-2">
              <label className="btn btn-ghost h-9 cursor-pointer text-[10px]">{m.qr ? "Replace QR" : "Upload QR"}
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upd(i, { qr: await fileToCompactDataUrl(f) }); }} />
              </label>
              {m.qr && <button type="button" className="btn btn-ghost h-9 text-[10px]" onClick={() => upd(i, { qr: "" })}>Remove QR</button>}
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-ghost" onClick={() => setS({ ...s, methods: [...s.methods, { id: `m-${Date.now()}`, label: "", name: "", address: "", note: "", qr: "" }] })}>+ Add another payment method</button>
      <div className="flex items-center gap-4">
        <button disabled={busy} onClick={save} className="btn btn-primary">{busy ? "Saving…" : "Save payment section"}</button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </div>
      <p className="text-xs text-muted-foreground">QR pictures are saved inside the store settings, so they never expire or disappear.</p>
    </div>
  );
}
