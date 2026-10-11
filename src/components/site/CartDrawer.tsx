import { useCallback, useEffect, useState } from "react";
import { CURRENCY, ORDERING_ENABLED, PHONE_NUMBER } from "@/config";
import { useStoreSettings } from "@/lib/store-settings";

type PastOrder = { id: string; date: string; total: number; items: string[]; status: string };
const HISTORY_KEY = "vice-order-history";
const loadHistory = (): PastOrder[] => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; } };
const saveHistory = (h: PastOrder[]) => localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 50)));
import { bundles, getProduct, loadCatalog } from "@/data/products";
import { supabase } from "@/integrations/supabase/client";
import { normStatus } from "@/lib/order-status";
import {
  cart, GOVERNORATES, initCart, lineTotal, loadCustomer, saveCustomer, useCart,
  emptyCustomer, type CartLine, type Customer,
} from "@/lib/cart";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(n);
const PHONE_RE = /^\+?[0-9\s-]{9,15}$/;

// Customer-facing order card look per status (light background, colored mark, clear message).
const CARD: Record<string, { box: string; dot: string; icon: string; text: string }> = {
  Pending: { box: "border-yellow-400 bg-yellow-100 text-yellow-950", dot: "bg-yellow-400 text-yellow-950", icon: "🕒", text: "Please wait for your order to be confirmed." },
  Confirmed: { box: "border-sky-400 bg-sky-100 text-sky-950", dot: "bg-sky-600 text-white", icon: "✓", text: "Your order is confirmed. We'll start preparing it soon." },
  Processing: { box: "border-blue-400 bg-blue-100 text-blue-950", dot: "bg-blue-500 text-white", icon: "⟳", text: "We're preparing your order." },
  Missing: { box: "border-neutral-400 bg-neutral-100 text-neutral-900", dot: "bg-neutral-500 text-white", icon: "?", text: "We couldn't find this order in our system. Contact us on WhatsApp with your order number." },
  Shipped: { box: "border-emerald-400 bg-emerald-50 text-emerald-950", dot: "bg-emerald-600 text-white", icon: "🚚", text: "Your order is on its way." },
  Completed: { box: "border-green-400 bg-green-100 text-green-950", dot: "bg-green-600 text-white", icon: "✓", text: "Delivered. Thanks for riding with Vice!" },
  Declined: { box: "border-red-400 bg-red-100 text-red-950", dot: "bg-red-600 text-white", icon: "✕", text: "This order was declined. Contact us on WhatsApp." },
  Canceled: { box: "border-red-400 bg-red-100 text-red-950", dot: "bg-red-600 text-white", icon: "✕", text: "You canceled this order." },
};

function buildMessage(id: string, lines: CartLine[], c: Customer, total: number) {
  const rows = lines.flatMap((l) => {
    if (l.kind === "bundle") {
      const b = bundles.find((x) => x.id === l.bundleId);
      const head = `• ${b?.name ?? "Bundle"} (bundle) × ${l.qty} — ${money(lineTotal(l))}`;
      const parts = l.pieces.map((pc) => `   – ${getProduct(pc.productId)?.name} — ${pc.color} — ${pc.size}`);
      return [head, ...parts];
    }
    const pc = l.pieces[0];
    if (!pc) return [];
    return [`• ${getProduct(pc.productId)?.name} — ${pc.color} — ${pc.size} × ${l.qty} — ${money(lineTotal(l))}`];
  });
  return [
    `New order ${id}`, "", ...rows, "",
    `Total: ${money(total)} (shipping to be confirmed)`, `Payment: paid online — receipt sent here`, "",
    `Name: ${c.name}`, `Phone: ${c.phone}`, `Governorate: ${c.governorate}`, `Address: ${c.address}`, `Notes: ${c.notes || "—"}`,
  ].join("\n");
}

export function CartDrawer() {
  const s = useCart();
  const pay = useStoreSettings();
  const [step, setStep] = useState<"cart" | "checkout" | "pay" | "history">("cart");
  const [form, setForm] = useState<Customer>(emptyCustomer);
  const [errors, setErrors] = useState<Partial<Record<keyof Customer | "sizes", string>>>({});
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<PastOrder[]>([]);
  const [copied, setCopied] = useState(false);
  const [sentNote, setSentNote] = useState("");
  const [cancelId, setCancelId] = useState("");
  const [receipt, setReceipt] = useState("");
  const [payErr, setPayErr] = useState("");

  useEffect(() => {
    loadCatalog().finally(initCart); setForm(loadCustomer()); setHistory(loadHistory());
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("full_name,phone,governorate,address").eq("id", u.user.id).maybeSingle();
      if (p) setForm((f) => ({ ...f, name: f.name || p.full_name || "", phone: f.phone || p.phone || "", governorate: f.governorate || p.governorate || "", address: f.address || p.address || "" }));
    })();
  }, []);
  useEffect(() => { if (!s.open) setStep("cart"); }, [s.open]);
  const [live, setLive] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [checkedAt, setCheckedAt] = useState("");
  const [statusErr, setStatusErr] = useState("");

  const [checked, setChecked] = useState(false);
  const refreshStatuses = useCallback(() => {
    if (!history.length) return Promise.resolve();
    setRefreshing(true);
    setStatusErr("");
    return (supabase.rpc as any)("order_statuses", { codes: history.map((o) => o.id) })
      .then(({ data, error }: { data: { order_code: string; status: string }[] | null; error: unknown }) => {
        if (error) { setStatusErr("Couldn't check your order status right now. Please try again."); return; }
        setLive(Object.fromEntries((data ?? []).map((r) => [r.order_code, normStatus(r.status)])));
        setChecked(true);
        setCheckedAt(new Date().toLocaleTimeString());
      }, () => setStatusErr("Couldn't check your order status right now. Please try again."))
      .finally(() => setRefreshing(false));
  }, [history]);

  // Check on load, whenever the drawer or "My orders" opens, every 15s while it's open, and when the tab regains focus.
  useEffect(() => { void refreshStatuses(); }, [refreshStatuses]);
  useEffect(() => {
    if (!s.open || !history.length) return;
    void refreshStatuses();
    const t = setInterval(() => void refreshStatuses(), 15000);
    const onFocus = () => void refreshStatuses();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [s.open, step, refreshStatuses]);
  useEffect(() => {
    if (!s.open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cart.close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [s.open]);

  if (!ORDERING_ENABLED) return null;
  const subtotal = s.lines.reduce((t, l) => t + lineTotal(l), 0);
  const missingSize = s.lines.some((l) => l.pieces.some((p) => !p.size));

  const update = (k: keyof Customer, v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    saveCustomer(next);
  };

  const submit = () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Enter your name";
    if (!PHONE_RE.test(form.phone.trim())) e.phone = "Enter a valid phone number, e.g. 09XX XXX XXX";
    if (!form.governorate) e.governorate = "Choose your governorate";
    if (!form.address.trim()) e.address = "Enter your full address";
    if (missingSize) e.sizes = "Choose a size for every item";
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep("pay");
  };

  const pickReceipt = (f?: File) => {
    setPayErr("");
    if (!f) return;
    if (!f.type.startsWith("image/")) return setPayErr("Upload an image (screenshot or photo of the receipt).");
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * k; c.height = img.height * k;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      setReceipt(c.toDataURL("image/jpeg", 0.7));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };

  const send = async () => {
    if (busy) return;
    if (!receipt) return setPayErr("Upload your payment screenshot first — orders without a receipt are not held.");
    setBusy(true);
    const id = `#VC-${Math.floor(1000 + Math.random() * 9000)}`;
    const items = s.lines.map((l) => l.kind === "bundle" ? `${bundles.find((b) => b.id === l.bundleId)?.name ?? "Bundle"} × ${l.qty}` : `${getProduct(l.pieces[0]?.productId ?? "")?.name} (${l.pieces[0]?.size}) × ${l.qty}`);
    const { data: authUser } = await supabase.auth.getUser();
    const { error } = await supabase.from("orders").insert({
      user_id: authUser.user?.id ?? null,
      order_code: id, status: "Pending", name: form.name.trim(), phone: form.phone.trim(), governorate: form.governorate,
      address: form.address.trim(), notes: form.notes.trim() || null, total: subtotal,
      items: [
        ...s.lines.map((l) => ({ kind: l.kind, bundleId: l.bundleId ?? null, qty: l.qty, unitPrice: l.unitPrice, pieces: l.pieces.map((pc) => ({ ...pc, name: getProduct(pc.productId)?.name ?? pc.productId })) })),
        { kind: "receipt", image: receipt },
      ],
    });
    if (error) { setBusy(false); return setPayErr("Couldn't place the order, please try again."); }
    setSentNote("Order placed with your receipt. We'll confirm it soon — watch the status here.");
    const next = [{ id, date: new Date().toISOString(), total: subtotal, items, status: "Pending" }, ...history];
    setHistory(next); saveHistory(next);
    cart.clearAfterOrder();
    setReceipt("");
    setStep("history");
    setBusy(false);
  };

  const cancelOrder = async (id: string) => {
    setCancelId("");
    const { error } = await (supabase.rpc as any)("cancel_order", { code: id });
    if (error) { setStatusErr("Couldn't cancel this order right now. Please try again."); return; }
    const next = history.map((o) => (o.id === id ? { ...o, status: "Canceled" } : o));
    setHistory(next); saveHistory(next);
    setLive((l) => ({ ...l, [id]: "Canceled" }));
    void refreshStatuses();
  };

  return (
    <>
      <div onClick={cart.close} className={`fixed inset-0 z-50 bg-background/70 backdrop-blur-sm transition-opacity ${s.open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside
        role="dialog" aria-label="Cart" aria-hidden={!s.open}
        className={`fixed right-0 top-0 z-50 flex h-[100dvh] w-full max-w-md flex-col border-l border-border bg-background transition-transform duration-300 ${s.open ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
          {step === "checkout" || step === "history" ? (
            <button onClick={() => setStep("cart")} className="nav-link hover:text-foreground">← Cart</button>
          ) : step === "pay" ? (
            <button onClick={() => setStep("checkout")} className="nav-link hover:text-foreground">← Details</button>
          ) : (
            <div className="flex items-center gap-4">
              <h2 className="font-display text-sm font-semibold uppercase tracking-[.2em]">Your cart</h2>
              <button onClick={() => { setSentNote(""); setStep("history"); }} className="nav-link hover:text-foreground">My orders{history.length ? ` (${history.length})` : ""}</button>
            </div>
          )}
          <button onClick={cart.close} aria-label="Close cart" className="icon-btn">✕</button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {s.notices.length > 0 && (
            <div className="mb-4 border border-primary/40 bg-primary/10 p-3 text-xs">
              {s.notices.map((n) => <p key={n}>{n}</p>)}
              <button onClick={cart.dismissNotices} className="mt-2 underline underline-offset-4">OK</button>
            </div>
          )}

          {step === "cart" && (s.lines.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">Your cart is empty.</p>
              {s.restore && (
                <button onClick={cart.restore} className="mt-4 text-sm text-primary underline underline-offset-4">Restore cart</button>
              )}
              {s.restore && <p className="mt-2 text-xs text-muted-foreground">Closed WhatsApp before sending? Bring your order back.</p>}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {s.lines.map((l) => <Line key={l.key} l={l} />)}
            </ul>
          ))}

          {step === "history" && (
            <div className="space-y-4">
              {sentNote && <p className="border border-primary/40 bg-primary/10 p-3 text-xs">{sentNote}</p>}
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-sm font-semibold uppercase tracking-[.2em]">Order history</h3>
                {history.length > 0 && (
                  <button
                    onClick={() => void refreshStatuses()}
                    disabled={refreshing}
                    aria-label="Refresh order statuses"
                    className="inline-flex shrink-0 items-center gap-2 border border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.2em] hover:border-primary disabled:opacity-60"
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={refreshing ? "animate-spin" : ""}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
                    {refreshing ? "Checking…" : "Refresh"}
                  </button>
                )}
              </div>
              {statusErr ? (
                <p className="text-xs text-primary">{statusErr}</p>
              ) : checkedAt ? (
                <p className="text-[11px] text-muted-foreground">Status checked at {checkedAt}</p>
              ) : null}
              {history.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
                <ul className="space-y-3">
                  {history.map((o) => {
                    const fromDb = live[o.id];
                    const st = fromDb === "Archived" ? "Pending" : fromDb ?? (checked ? "Missing" : o.status === "Canceled" ? "Canceled" : "Pending");
                    const canCancel = st === "Pending";
                    return (
                    <li key={o.id + o.date} className={`rounded-md border p-4 ${(CARD[st] ?? CARD["Pending"]!).box}`}>
                      <div className="flex justify-between text-sm font-semibold"><span>{o.id}</span><span>{money(o.total)}</span></div>
                      <p className="text-xs opacity-70">{new Date(o.date).toLocaleString()}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`grid h-7 w-7 place-items-center rounded-full text-sm ${(CARD[st] ?? CARD["Pending"]!).dot}`}>{(CARD[st] ?? CARD["Pending"]!).icon}</span>
                        <span className="text-sm font-bold uppercase tracking-widest">{st === "Missing" ? "Not found" : st}</span>
                      </div>
                      <p className="mt-1 text-xs font-medium">{(CARD[st] ?? CARD["Pending"]!).text}</p>
                      <ul className="mt-2 text-xs">{o.items.map((it, i) => <li key={i}>• {it}</li>)}</ul>
                      {canCancel && (cancelId === o.id ? (
                        <div className="mt-3 space-y-2">
                          <SlideToCancel onDone={() => cancelOrder(o.id)} />
                          <button onClick={() => setCancelId("")} className="text-xs text-muted-foreground underline">Keep my order</button>
                        </div>
                      ) : (
                        <button onClick={() => setCancelId(o.id)} className="mt-2 text-xs text-primary underline underline-offset-4">Cancel order</button>
                      ))}
                      {st === "Canceled" && (
                        <div className="mt-3 border border-primary/40 bg-primary/10 p-3 text-xs">
                          <p>Your order was canceled. Contact us on WhatsApp <b>{PHONE_NUMBER}</b> to get your refund.</p>
                          <a href={`https://wa.me/${PHONE_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi Vice, I canceled order ${o.id} (${money(o.total)}) and would like a refund.`)}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-2 h-9 w-full text-[10px]">Contact us for refund</a>
                        </div>
                      )}
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {step === "pay" && (
            <div className="space-y-4 text-center">
              <p className="nav-link">Step 2 — Pay {money(subtotal)}</p>
              <img src={pay.qrUrl} alt="Payment QR code" className="mx-auto w-56 rounded-lg" />
              <div className="border border-border p-3 text-left text-sm">
                <p><span className="text-muted-foreground">Name: </span>{pay.paymentName}</p>
                <p className="mt-1 break-all"><span className="text-muted-foreground">Address: </span>{pay.paymentAddress}</p>
                <button onClick={() => { navigator.clipboard?.writeText(pay.paymentAddress); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="mt-2 text-xs text-primary underline underline-offset-4">{copied ? "Copied!" : "Copy address"}</button>
              </div>
              <p className="text-success text-sm font-medium">Pay with the QR code, then upload your payment screenshot. Orders without a receipt are not held.</p>
              <label className="block cursor-pointer border border-dashed border-border p-4 text-sm">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickReceipt(e.target.files?.[0])} />
                {receipt ? <img src={receipt} alt="Your receipt" className="mx-auto max-h-48" /> : <span>Tap to upload receipt screenshot</span>}
                {receipt && <span className="mt-2 block text-xs text-primary underline">Change screenshot</span>}
              </label>
              {payErr && <p className="text-xs text-primary">{payErr}</p>}
            </div>
          )}

          {step === "checkout" && (
            <div className="space-y-4">
              <Field label="Name" error={errors.name}><input className="field" value={form.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" /></Field>
              <Field label="Phone" error={errors.phone}><input className="field" type="tel" inputMode="tel" placeholder="09XX XXX XXX" value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" /></Field>
              <Field label="Governorate" error={errors.governorate}>
                <select className="field" value={form.governorate} onChange={(e) => update("governorate", e.target.value)}>
                  <option value="">Select…</option>
                  {GOVERNORATES.map((g) => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Full address" error={errors.address}><textarea className="field min-h-20 py-3" value={form.address} onChange={(e) => update("address", e.target.value)} autoComplete="street-address" /></Field>
              <Field label="Notes (optional)"><textarea className="field min-h-16 py-3" value={form.notes} onChange={(e) => update("notes", e.target.value)} /></Field>
            </div>
          )}
        </div>

        {s.lines.length > 0 && step !== "history" && (
          <footer className="shrink-0 border-t border-border px-5 py-5">
            <div className="flex items-baseline justify-between">
              <span className="nav-link">Subtotal</span>
              <span className="text-lg font-semibold">{money(subtotal)}</span>
            </div>
            <p className="mt-2 text-xs text-foreground">Pay online and upload your receipt to place the order.</p>
            {errors.sizes && <p className="mt-2 text-xs text-primary">{errors.sizes}</p>}
            {step === "cart" ? (
              <button
                onClick={() => { if (missingSize) setErrors({ sizes: "Choose a size for every item" }); else { setErrors({}); setStep("checkout"); } }}
                className="btn btn-primary mt-4 w-full"
              >Checkout</button>
            ) : step === "checkout" ? (
              <button onClick={submit} className="btn btn-primary mt-4 w-full">Pay & Checkout</button>
            ) : step === "pay" ? (
              <button onClick={send} disabled={busy || !receipt} className="btn btn-primary mt-4 w-full disabled:opacity-50">
                {busy ? "Placing order…" : "Place order"}
              </button>
            ) : null}
          </footer>
        )}
      </aside>
    </>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="nav-link mb-2 block">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-primary">{error}</span>}
    </label>
  );
}

function Line({ l }: { l: CartLine }) {
  const bundle = l.kind === "bundle" ? bundles.find((b) => b.id === l.bundleId) : undefined;
  const first = getProduct(l.pieces[0]?.productId ?? "");
  return (
    <li className="py-4 first:pt-0">
      <div className="flex gap-3">
        <img src={first?.images[0]} alt={first?.name} className="h-24 w-20 shrink-0 object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium uppercase tracking-wide">{bundle ? bundle.name : first?.name}</p>
            <span className="text-sm">{money(lineTotal(l))}</span>
          </div>
          {bundle && <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-primary">Bundle price {money(l.unitPrice)}</p>}
          <div className="mt-2 space-y-2">
            {l.pieces.map((pc, i) => {
              const p = getProduct(pc.productId);
              if (!p) return null;
              return (
                <div key={i}>
                  {bundle && <p className="mb-1 truncate text-xs text-muted-foreground">{p.name}</p>}
                  <div className="flex gap-2">
                    <select aria-label="Color" className="field h-8 flex-1 px-2 text-xs" value={pc.color} onChange={(e) => cart.setPiece(l.key, i, { color: e.target.value })}>
                      {p.colors.map((c) => <option key={c.name}>{c.name}</option>)}
                    </select>
                    <select aria-label="Size" className={`field h-8 flex-1 px-2 text-xs ${!pc.size ? "border-primary" : ""}`} value={pc.size} onChange={(e) => cart.setPiece(l.key, i, { size: e.target.value })}>
                      {!pc.size && <option value="">Size</option>}
                      {p.sizes.map((sz) => <option key={sz}>{sz}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="inline-flex items-center border border-border">
              <button onClick={() => cart.setQty(l.key, l.qty - 1)} className="h-8 w-8" aria-label="Less">−</button>
              <span className="w-7 text-center text-xs">{l.qty}</span>
              <button onClick={() => cart.setQty(l.key, l.qty + 1)} className="h-8 w-8" aria-label="More">+</button>
            </div>
            <button onClick={() => cart.remove(l.key)} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Remove</button>
          </div>
        </div>
      </div>
    </li>
  );
}

function SlideToCancel({ onDone }: { onDone: () => void }) {
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState<{ start: number; max: number } | null>(null);
  const KNOB = 44;
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = e.currentTarget.parentElement!;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ start: e.clientX - x, max: track.clientWidth - KNOB - 8 });
  };
  const move = (e: React.PointerEvent) => { if (drag) setX(Math.max(0, Math.min(drag.max, e.clientX - drag.start))); };
  const up = () => { if (!drag) return; if (x >= drag.max - 4) onDone(); else setX(0); setDrag(null); };
  return (
    <div className="relative h-[52px] select-none overflow-hidden rounded-full bg-destructive/15 p-1">
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[.2em] text-destructive" style={{ opacity: Math.max(0.15, 1 - x / 150) }}>Slide to cancel →</span>
      <div
        role="slider" aria-label="Slide to cancel order" aria-valuenow={x}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className={`relative z-10 flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-full bg-destructive text-destructive-foreground ${drag ? "" : "transition-transform duration-300"}`}
        style={{ transform: `translateX(${x}px)` }}
      >✕</div>
    </div>
  );
}
