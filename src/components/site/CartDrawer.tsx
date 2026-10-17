import { useCallback, useEffect, useState } from "react";
import { CURRENCY, ORDERING_ENABLED, PHONE_NUMBER } from "@/config";
import { useStoreSettings } from "@/lib/store-settings";
import { ReceiptPrinter, type ReceiptOrder } from "@/components/site/ReceiptPrinter";

type PastOrder = { id: string; date: string; total: number; items: string[]; status: string };
const HISTORY_KEY = "vice-order-history";
const loadHistory = (): PastOrder[] => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; } };
const saveHistory = (h: PastOrder[]) => localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 50)));
import { bundles, getProduct, loadCatalog } from "@/data/products";
import { supabase } from "@/lib/store-client";
import { storeClient } from "@/lib/store-client";
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
  const [copied, setCopied] = useState("");
  const [printing, setPrinting] = useState<ReceiptOrder | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  useEffect(() => { try { setHidden(JSON.parse(localStorage.getItem("vice-user-archived-orders") || "[]")); } catch { /* ignore */ } }, []);
  const toggleHidden = (id: string) => setHidden((h) => {
    const next = h.includes(id) ? h.filter((x) => x !== id) : [...h, id];
    localStorage.setItem("vice-user-archived-orders", JSON.stringify(next));
    return next;
  });
  const [sentNote, setSentNote] = useState("");
  const [cancelId, setCancelId] = useState("");
  const [receipt, setReceipt] = useState("");
  const [payErr, setPayErr] = useState("");

  useEffect(() => {
    loadCatalog().finally(initCart); setForm({ ...loadCustomer(), address: "" }); setHistory(loadHistory());
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      // Address is intentionally never auto-filled — customers type it for every order.
      const { data: p } = await storeClient.from("profiles").select("full_name,phone").eq("id", u.user.id).maybeSingle();
      if (p) setForm((f) => ({ ...f, name: f.name || p.full_name || "", phone: f.phone || p.phone || "" }));
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
    // The database hands out the next number (#VC-101, #VC-102, ...) atomically.
    const { data: code, error: codeErr } = await (storeClient.rpc as any)("next_order_code");
    if (codeErr || typeof code !== "string") { setBusy(false); return setPayErr("Couldn't place the order, please try again."); }
    const id = code;
    const items = s.lines.map((l) => l.kind === "bundle" ? `${bundles.find((b) => b.id === l.bundleId)?.name ?? "Bundle"} × ${l.qty}` : `${getProduct(l.pieces[0]?.productId ?? "")?.name} (${l.pieces[0]?.size}) × ${l.qty}`);
    const { data: authUser } = await supabase.auth.getUser();
    const { error } = await storeClient.from("orders").insert({
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
    const placed = { id, date: new Date().toISOString(), total: subtotal, items, status: "Pending" };
    const next = [placed, ...history];
    setHistory(next); saveHistory(next);
    setPrinting({ ...placed, name: form.name.trim() });
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
              <button onClick={() => { setSentNote(""); setShowHidden(false); setStep("history"); }} className="nav-link hover:text-foreground">My orders</button>
              <button onClick={() => { setSentNote(""); setShowHidden(true); setStep("history"); }} className="nav-link hover:text-foreground">Archived</button>
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
              {sentNote && (
                <div className="flex items-start gap-3 rounded-lg border border-success/35 bg-success/10 p-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success text-[11px] font-bold text-success-foreground">✓</span>
                  <p className="text-xs leading-snug text-foreground">{sentNote}</p>
                </div>
              )}
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
              <div className="grid grid-cols-2 border border-border text-[11px] font-semibold uppercase tracking-[.2em]">
                <button onClick={() => setShowHidden(false)} className={`py-2 ${!showHidden ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>My orders ({history.filter((o) => !hidden.includes(o.id)).length})</button>
                <button onClick={() => setShowHidden(true)} className={`py-2 ${showHidden ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Archived ({history.filter((o) => hidden.includes(o.id)).length})</button>
              </div>
              {history.filter((o) => hidden.includes(o.id) === showHidden).length === 0 ? <p className="text-sm text-muted-foreground">{showHidden ? "No archived orders. Archive an order to move it here." : "No orders yet."}</p> : (
                <ul className="space-y-3">
                  {history.filter((o) => hidden.includes(o.id) === showHidden).map((o) => {
                    const fromDb = live[o.id];
                    const st = fromDb === "Archived" ? "Pending" : fromDb ?? (checked ? "Missing" : o.status === "Canceled" ? "Canceled" : "Pending");
                    const canCancel = st === "Pending";
                    return (
                    <li key={o.id + o.date} className={`overflow-hidden rounded-lg border ${(CARD[st] ?? CARD["Pending"]!).box}`}>
                      <div className="flex items-center gap-3 px-4 pt-4">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm ${(CARD[st] ?? CARD["Pending"]!).dot}`}>{(CARD[st] ?? CARD["Pending"]!).icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold uppercase tracking-widest">{st === "Missing" ? "Not found" : st}</p>
                          <p className="text-xs opacity-80">{(CARD[st] ?? CARD["Pending"]!).text}</p>
                        </div>
                      </div>
                      <dl className="mx-4 mt-4 grid grid-cols-3 gap-2 border-y border-current/15 py-3 text-xs">
                        <div><dt className="opacity-60">Order</dt><dd className="font-semibold">{o.id}</dd></div>
                        <div><dt className="opacity-60">Date</dt><dd className="font-semibold">{new Date(o.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {new Date(o.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</dd></div>
                        <div className="text-right"><dt className="opacity-60">Total</dt><dd className="font-semibold">{money(o.total)}</dd></div>
                      </dl>
                      <ul className="space-y-1.5 px-4 py-3 text-xs">
                        {o.items.map((it, i) => <li key={i} className="flex gap-2"><span className="opacity-40">—</span><span>{it}</span></li>)}
                      </ul>
                      {st === "Canceled" && (
                        <div className="mx-4 mb-3 rounded-md bg-background/60 p-3 text-xs text-foreground">
                          <p>Contact us on WhatsApp <b>{PHONE_NUMBER}</b> to get your refund.</p>
                          <a href={`https://wa.me/${PHONE_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi Vice, I canceled order ${o.id} (${money(o.total)}) and would like a refund.`)}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-2 h-9 w-full text-[10px]">Contact us for refund</a>
                        </div>
                      )}
                      {canCancel && cancelId === o.id && (
                        <div className="space-y-2 px-4 pb-3">
                          <SlideToCancel onDone={() => cancelOrder(o.id)} />
                          <button onClick={() => setCancelId("")} className="text-xs underline opacity-70">Keep my order</button>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t border-current/15 px-4 py-2 text-[11px]">
                        <span className="flex gap-4">
                          <button onClick={() => toggleHidden(o.id)} className="underline underline-offset-4 opacity-70 hover:opacity-100">{hidden.includes(o.id) ? "Unarchive" : "Archive"}</button>
                          <button onClick={() => setPrinting({ ...o, status: st })} className="font-semibold underline underline-offset-4">🧾 Receipt</button>
                        </span>
                        {canCancel && cancelId !== o.id && <button onClick={() => setCancelId(o.id)} className="font-semibold text-red-700 underline underline-offset-4">Cancel order</button>}
                      </div>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {step === "pay" && (
            <div className="space-y-5">
              <Steps at={2} />
              <div className="rounded-2xl border border-border bg-muted p-5 text-center">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Amount to send</p>
                <p className="mt-1 font-display text-4xl font-bold">{money(subtotal)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Send this exact amount</p>
              </div>
              <div className="rounded-2xl border border-border p-4 text-center">
                <img src={pay.qrUrl} alt="Payment QR code" className="mx-auto w-full max-w-60 rounded-xl" />
                <button
                  onClick={async () => {
                    try {
                      const blob = await (await fetch(pay.qrUrl)).blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = "vice-payment-qr.jpg"; a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } catch { window.open(pay.qrUrl, "_blank"); }
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-foreground/5"
                >
                  ⬇ Download
                </button>
                <p className="mt-3 text-xs text-muted-foreground">{pay.paymentName}</p>
              </div>
              <div className="space-y-2">
                {([["Payment ID", pay.paymentAddress, "addr"]] as const).map(([label, value, key]) => (
                  <div key={key} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="break-all font-mono text-sm font-medium">{value}</p>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(value); setCopied(key); setTimeout(() => setCopied(""), 1500); }}
                      className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
                    >
                      {copied === key ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                ))}
              </div>
              <ol className="space-y-2 text-sm">
                {["Download the QR or copy the address", "Send the exact amount in your payment app", "Upload your payment screenshot below"].map((t, i) => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-xs font-bold text-success-foreground">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
              <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-border p-5 text-center text-sm">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickReceipt(e.target.files?.[0])} />
                {receipt ? <img src={receipt} alt="Your receipt" className="mx-auto max-h-48 rounded-lg" /> : <span className="block"><span className="block text-2xl">⬆</span><span className="font-semibold">Tap to upload screenshot</span><span className="block text-xs text-muted-foreground">PNG or JPG</span></span>}
                {receipt && <span className="mt-2 block text-xs text-success underline">Change screenshot</span>}
              </label>
              <p className="text-center text-xs text-muted-foreground">Orders without a payment screenshot are not held.</p>
              {payErr && <p className="text-xs text-primary">{payErr}</p>}
            </div>
          )}

          {step === "checkout" && (
            <div className="space-y-5">
              <Steps at={1} />
              <section className="space-y-4 rounded-lg border border-border p-4">
                <p className="nav-link">Contact</p>
                <Field label="Name" error={errors.name}><input className="field" value={form.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" /></Field>
                <Field label="Phone" error={errors.phone}><input className="field" type="tel" inputMode="tel" placeholder="09XX XXX XXX" value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" /></Field>
              </section>
              <section className="space-y-4 rounded-lg border border-border p-4">
                <p className="nav-link">Delivery</p>
                <Field label="Governorate" error={errors.governorate}>
                  <select className="field" value={form.governorate} onChange={(e) => update("governorate", e.target.value)}>
                    <option value="">Select…</option>
                    {GOVERNORATES.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Full address" error={errors.address}><textarea className="field min-h-20 py-3" value={form.address} onChange={(e) => update("address", e.target.value)} autoComplete="street-address" /></Field>
                <Field label="Notes (optional)"><textarea className="field min-h-16 py-3" value={form.notes} onChange={(e) => update("notes", e.target.value)} /></Field>
              </section>
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
              <button onClick={submit} className="btn mt-4 w-full bg-success text-success-foreground hover:opacity-90">Pay & Checkout</button>
            ) : step === "pay" ? (
              <button onClick={send} disabled={busy || !receipt} className="btn mt-4 w-full bg-success text-success-foreground hover:opacity-90 disabled:opacity-50">
                {busy ? "Placing order…" : "Place order"}
              </button>
            ) : null}
          </footer>
        )}
      </aside>
      {printing && <ReceiptPrinter order={printing} onClose={() => setPrinting(null)} />}
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
            <div className="inline-flex h-8 items-center rounded-full border border-border bg-foreground/5">
              <button onClick={() => cart.setQty(l.key, l.qty - 1)} disabled={l.qty <= 1} className="grid h-8 w-8 place-items-center rounded-full text-sm transition hover:bg-foreground/10 disabled:opacity-30" aria-label="Less">−</button>
              <span key={l.qty} className="w-6 text-center text-xs font-semibold tabular-nums animate-in fade-in zoom-in-75">{l.qty}</span>
              <button onClick={() => cart.setQty(l.key, Math.min(10, l.qty + 1))} disabled={l.qty >= 10} className="grid h-8 w-8 place-items-center rounded-full text-sm transition hover:bg-foreground/10 disabled:opacity-30" aria-label="More">+</button>
            </div>
            <button onClick={() => cart.remove(l.key)} className="text-[11px] uppercase tracking-[.2em] text-muted-foreground hover:text-primary">Remove</button>
          </div>
        </div>
      </div>
    </li>
  );
}

function Steps({ at }: { at: 1 | 2 }) {
  return (
    <ol className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em]">
      {["Details", "Pay"].map((t, i) => (
        <li key={t} className={`flex flex-1 items-center gap-2 ${i + 1 <= at ? "text-foreground" : "text-muted-foreground"}`}>
          <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${i + 1 <= at ? "bg-primary text-primary-foreground" : "border border-border"}`}>{i + 1}</span>
          {t}
          {i === 0 && <span className={`h-px flex-1 ${at > 1 ? "bg-primary" : "bg-border"}`} />}
        </li>
      ))}
    </ol>
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
