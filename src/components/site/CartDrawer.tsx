import { useCallback, useEffect, useState } from "react";
import { CURRENCY, ORDERING_ENABLED, PHONE_NUMBER } from "@/config";
import { useStoreSettings } from "@/lib/store-settings";
import { Check, CheckCircle2, Clock, Download, HelpCircle, Loader, Receipt, Truck, UploadCloud, X, XCircle, Copy, type LucideIcon } from "lucide-react";
import { ReceiptPrinter, type ReceiptOrder } from "@/components/site/ReceiptPrinter";

type PastOrder = { id: string; date: string; total: number; items: string[]; status: string; token?: string };
const HISTORY_KEY = "vice-order-history";
const loadHistory = (): PastOrder[] => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; } };
const saveHistory = (h: PastOrder[]) => localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 50)));
import { bundles, getProduct, loadCatalog } from "@/data/products";
import { supabase } from "@/lib/store-client";
import { storeClient } from "@/lib/store-client";
import { normStatus } from "@/lib/order-status";
import { applyCoupon, customerNumber, type Coupon } from "@/lib/coupons";
import { OTHER_BRANCH, SHIPPING_COMPANIES, areasFor, branchesFor, companyName } from "@/data/shipping";
/** The chosen area, or the only area when a governorate has just one. */
const areaOf = (f: Customer) => { const a = areasFor(f.company, f.governorate); return a.length === 1 ? a[0] ?? "" : a.includes(f.area) ? f.area : ""; };
import {
  cart, GOVERNORATES, initCart, lineTotal, loadCustomer, saveCustomer, useCart,
  emptyCustomer, type CartLine, type Customer, stockProblems } from "@/lib/cart";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(n);
const PHONE_RE = /^09\d{8}$/;

// Customer-facing order card look per status (light background, colored mark, clear message).
const CARD: Record<string, { tone: string; icon: LucideIcon; text: string }> = {
  Pending: { tone: "text-amber-600", icon: Clock, text: "Waiting for confirmation." },
  Confirmed: { tone: "text-sky-600", icon: CheckCircle2, text: "Confirmed. We'll start preparing it soon." },
  Processing: { tone: "text-blue-600", icon: Loader, text: "We're preparing your order." },
  Missing: { tone: "text-muted-foreground", icon: HelpCircle, text: "We couldn't find this order. Contact us on WhatsApp with your order number." },
  Shipped: { tone: "text-emerald-600", icon: Truck, text: "Your order is on its way." },
  Completed: { tone: "text-green-600", icon: CheckCircle2, text: "Delivered. Thanks for riding with Vice!" },
  Declined: { tone: "text-red-600", icon: XCircle, text: "This order was declined. Contact us on WhatsApp." },
  Canceled: { tone: "text-red-600", icon: XCircle, text: "You canceled this order." },
};


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
  const [couponIn, setCouponIn] = useState("");
  const [couponMsg, setCouponMsg] = useState("");
  const [applied, setApplied] = useState<Coupon | null>(null);
  const [couponCtx, setCouponCtx] = useState<{ id: number | null; used: string[] }>({ id: null, used: [] });

  useEffect(() => {
    const showOrders = () => { setSentNote(""); setShowHidden(false); setStep("history"); cart.open(); };
    window.addEventListener("vice:orders", showOrders);
    return () => window.removeEventListener("vice:orders", showOrders);
  }, []);
  const [promoOpen, setPromoOpen] = useState(false);

  // Signed-in customers see every order saved on their account, from any device.
  const syncAccountOrders = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return;
    const { data: rows, error } = await storeClient.from("orders").select("order_code,status,total,created_at,items,access_token").eq("user_id", uid).order("created_at", { ascending: false });
    if (error || !rows?.length) return;
    const describe = (i: any): string | null => {
      if (typeof i === "string") return i;
      if (!i || i.kind === "receipt") return null;
      if (i.kind === "coupon") return `COUPON ${i.code} −${money(Number(i.discount) || 0)}`;
      if (i.kind === "shipping") return `Shipping: ${[i.company, i.branch].filter(Boolean).join(" — ")}`;
      if (i.kind === "bundle") return `${bundles.find((b) => b.id === i.bundleId)?.name ?? "Bundle"} × ${i.qty ?? 1}`;
      const pc = Array.isArray(i.pieces) ? i.pieces[0] : null;
      if (pc) return `${pc.name ?? getProduct(pc.productId)?.name ?? "Item"}${pc.size ? ` (${pc.size})` : ""} × ${i.qty ?? 1}`;
      return `${i.name ?? "Item"}${i.size ? ` (${i.size})` : ""}${i.qty ? ` × ${i.qty}` : ""}`;
    };
    setHistory((local) => {
      const byId = new Map(local.map((o) => [o.id, o]));
      for (const r of rows as any[]) {
        const prev = byId.get(r.order_code);
        const items = Array.isArray(r.items) ? r.items.map(describe).filter((x: string | null): x is string => !!x) : prev?.items ?? [];
        byId.set(r.order_code, { id: r.order_code, date: prev?.date ?? r.created_at, total: Number(r.total), items: items.length ? items : prev?.items ?? [], status: normStatus(r.status), token: prev?.token ?? r.access_token ?? undefined });
      }
      const merged = [...byId.values()].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
      saveHistory(merged);
      return merged;
    });
  }, []);

  useEffect(() => {
    loadCatalog().finally(initCart); setForm(loadCustomer()); setHistory(loadHistory());
    void syncAccountOrders();
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      // Address is intentionally never auto-filled — customers type it for every order.
      const { data: p } = await storeClient.from("profiles").select("full_name,phone").eq("id", u.user.id).maybeSingle();
      if (p) setForm((f) => ({ ...f, name: f.name || p.full_name || "", phone: f.phone || p.phone || "" }));
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void syncAccountOrders();
    });
    return () => sub.subscription.unsubscribe();
  }, [syncAccountOrders]);
  useEffect(() => { if (s.open) void syncAccountOrders(); }, [s.open, syncAccountOrders]);
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
    return (supabase.rpc as any)("order_statuses", { tokens: history.map((o) => o.token).filter(Boolean) })
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
  const overStock = stockProblems(s.lines);
  const couponLines = s.lines.map((l) => ({ category: l.kind === "bundle" ? "bundle" : getProduct(l.pieces[0]?.productId ?? "")?.category ?? "", qty: l.qty, total: lineTotal(l) }));
  const live2 = applied ? applyCoupon(applied, { now: new Date(), lines: couponLines, customerId: couponCtx.id, usedCodes: couponCtx.used }) : null;
  const discount = live2?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);

  const tryCoupon = async () => {
    setCouponMsg("");
    const code = couponIn.trim().toUpperCase();
    if (!code) return;
    const { data } = await storeClient.from("store_settings").select("value").eq("key", "coupons_json").maybeSingle();
    let list: Coupon[] = [];
    try { list = data?.value ? JSON.parse(data.value) : []; } catch { /* ignore */ }
    const c = list.find((x) => x.code.toUpperCase() === code);
    const { data: u } = await supabase.auth.getUser();
    let id: number | null = null; let used: string[] = [];
    if (u.user) {
      id = customerNumber(u.user.id);
      const { data: ords } = await storeClient.from("orders").select("items,status").eq("user_id", u.user.id);
      used = (ords ?? []).filter((o: any) => !["Canceled", "Declined"].includes(normStatus(o.status)))
        .flatMap((o: any) => (Array.isArray(o.items) ? o.items : []).filter((i: any) => i?.kind === "coupon").map((i: any) => String(i.code)));
    }
    const r = applyCoupon(c, { now: new Date(), lines: couponLines, customerId: id, usedCodes: used });
    if (r.error) return setCouponMsg(r.error);
    setCouponCtx({ id, used }); setApplied(c!); setCouponMsg(`Saved ${money(r.discount ?? 0)}`);
  };

  const update = (k: keyof Customer, v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    saveCustomer(next);
  };

  const submit = () => {
    const e: typeof errors = {};
    if (!form.first.trim() || !form.father.trim() || !form.family.trim()) e.name = "Please fill in your first, father's and family name";
    if (!PHONE_RE.test(form.phone.replace(/\D/g, ""))) e.phone = "Phone must be 10 digits starting with 09";
    if (!form.governorate) e.governorate = "Choose your governorate";
    else if (areasFor(form.company, form.governorate).length > 1 && !form.area) e.area = "Choose your city / area";
    else if (!form.branch) e.branch = "Choose a branch";
    else if (form.branch === OTHER_BRANCH && !form.shipDetails.trim()) e.shipDetails = "Write the branch or shipping details";
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
    const areaText = areaOf(form) && areaOf(form) !== form.branch ? `${areaOf(form)} / ` : "";
    const branchText = areaText + (form.branch === OTHER_BRANCH ? form.shipDetails.trim() : [form.branch, form.shipDetails.trim()].filter(Boolean).join(" — "));
    const shipLine = `SHIP: ${companyName(form.company)} — ${branchText}`;
    const items = s.lines.map((l) => l.kind === "bundle" ? `${bundles.find((b) => b.id === l.bundleId)?.name ?? "Bundle"} × ${l.qty}` : `${getProduct(l.pieces[0]?.productId ?? "")?.name} (${l.pieces[0]?.size}) × ${l.qty}`);
    if (applied && discount) items.push(`COUPON ${applied.code} −${money(discount)}`);
    items.push(shipLine);
    const { data: authUser } = await supabase.auth.getUser();
    const token = crypto.randomUUID();
    const { error } = await storeClient.from("orders").insert({
      access_token: token,
      user_id: authUser.user?.id ?? null,
      order_code: id, status: "Pending", name: form.name.trim(), phone: form.phone.replace(/\D/g, ""), governorate: form.governorate,
      address: `${companyName(form.company)} — ${branchText}`, notes: [form.notes.trim(), applied && discount ? `Coupon ${applied.code} (−${discount})` : ""].filter(Boolean).join(" · ") || null, total,
      items: [
        ...s.lines.map((l) => ({ kind: l.kind, bundleId: l.bundleId ?? null, qty: l.qty, unitPrice: l.unitPrice, pieces: l.pieces.map((pc) => ({ ...pc, name: getProduct(pc.productId)?.name ?? pc.productId })) })),
        ...(applied && discount ? [{ kind: "coupon", code: applied.code, discount, subtotal }] : []),
        { kind: "shipping", company: companyName(form.company), branch: branchText },
        { kind: "receipt", image: receipt },
      ],
    });
    if (error) {
      setBusy(false);
      const m = error.message || "";
      if (m.includes("COUPON_INVALID")) { setApplied(null); return setPayErr("That coupon can't be used on this order anymore. Remove it and try again."); }
      if (m.includes("PRICE_MISMATCH")) return setPayErr("Some prices changed. Please refresh the page and check your cart.");
      return setPayErr("Couldn't place the order, please try again.");
    }
    playDoneChime();
    setSentNote("Order placed with your receipt. We'll confirm it soon — watch the status here.");
    const placed = { id, date: new Date().toISOString(), total, items, status: "Pending", token };
    const next = [placed, ...history];
    setHistory(next); saveHistory(next);
    setPrinting({ ...placed, name: form.name.trim() });
    setApplied(null); setCouponIn(""); setCouponMsg("");
    cart.clearAfterOrder();
    setReceipt("");
    setStep("history");
    setBusy(false);
  };

  const cancelOrder = async (id: string) => {
    setCancelId("");
    const { error } = await (supabase.rpc as any)("cancel_order", { code: id, token: history.find((o) => o.id === id)?.token ?? null });
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
          <button onClick={cart.close} aria-label="Close cart" className="icon-btn"><X size={18} strokeWidth={1.75} /></button>
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
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success text-success-foreground"><Check size={14} strokeWidth={2} /></span>
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
                    <li key={o.id + o.date} className="overflow-hidden rounded-xl border border-border bg-card">
                      {(() => { const c = CARD[st] ?? CARD["Pending"]!; const Ic = c.icon; return (
                      <div className="flex items-center gap-3 px-4 pt-4">
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border border-current/30 ${c.tone}`}><Ic size={18} strokeWidth={1.5} /></span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold uppercase tracking-[.2em] ${c.tone}`}>{st === "Missing" ? "Not found" : st}</p>
                          <p className="text-xs text-muted-foreground">{c.text}</p>
                        </div>
                        <p className="text-right text-sm font-semibold">{money(o.total)}</p>
                      </div>); })()}
                      <dl className="mx-4 mt-4 grid grid-cols-2 gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                        <div><dt className="text-muted-foreground">Order</dt><dd className="font-mono font-semibold">{o.id}</dd></div>
                        <div className="text-right"><dt className="text-muted-foreground">Placed</dt><dd className="font-semibold">{new Date(o.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {new Date(o.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</dd></div>
                      </dl>
                      <ul className="space-y-1.5 px-4 py-3 text-xs">
                        {o.items.map((it, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" /><span>{it}</span></li>)}
                      </ul>
                      {st === "Canceled" && (
                        <div className="mx-4 mb-3 rounded-lg bg-muted/50 p-3 text-xs text-foreground">
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
                      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px]">
                        <span className="flex gap-4">
                          <button onClick={() => toggleHidden(o.id)} className="underline underline-offset-4 opacity-70 hover:opacity-100">{hidden.includes(o.id) ? "Unarchive" : "Archive"}</button>
                          <button onClick={() => setPrinting({ ...o, status: st })} className="inline-flex items-center gap-1.5 font-semibold hover:text-primary"><Receipt size={14} strokeWidth={1.5} /> Receipt</button>
                        </span>
                        {canCancel && cancelId !== o.id && <button onClick={() => setCancelId(o.id)} className="font-semibold text-destructive hover:underline">Cancel order</button>}
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
              <div className="rounded-xl border border-border p-5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[.25em] text-muted-foreground">Amount to send</p>
                <p className="mt-2 font-display text-4xl font-bold">{money(total)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Send this exact amount via Sham Cash</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-4">
                  <img src={pay.qrUrl} alt="Payment QR code" className="w-32 shrink-0 rounded-lg border border-border bg-background p-1" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Recipient</p>
                      <p className="text-sm font-semibold">{pay.paymentName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Payment ID</p>
                      <p className="break-all font-mono text-xs">{pay.paymentAddress}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
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
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border text-xs font-semibold hover:border-primary"
                  ><Download size={15} strokeWidth={1.5} /> Save QR</button>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(pay.paymentAddress); setCopied("addr"); setTimeout(() => setCopied(""), 1500); }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border text-xs font-semibold hover:border-primary"
                  >{copied === "addr" ? <><Check size={15} strokeWidth={1.75} /> Copied</> : <><Copy size={15} strokeWidth={1.5} /> Copy ID</>}</button>
                </div>
              </div>
              <ol className="space-y-3 border-l border-border pl-4 text-sm">
                {["Save the QR or copy the payment ID", "Send the exact amount in the Sham Cash app", "Upload your payment screenshot below"].map((t, i) => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="-ml-[29px] grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-background font-mono text-[11px]">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
              <label className={`block cursor-pointer rounded-xl border border-dashed p-6 text-center text-sm transition-colors hover:border-primary ${receipt ? "border-success" : "border-border"}`}>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickReceipt(e.target.files?.[0])} />
                {receipt ? <img src={receipt} alt="Your receipt" className="mx-auto max-h-48 rounded-lg" /> : <span className="flex flex-col items-center gap-1.5"><UploadCloud size={26} strokeWidth={1.25} className="text-muted-foreground" /><span className="font-semibold">Upload payment screenshot</span><span className="text-xs text-muted-foreground">PNG or JPG</span></span>}
                {receipt && <span className="mt-3 block text-xs text-muted-foreground underline underline-offset-4">Change screenshot</span>}
              </label>
              <p className="text-center text-xs text-muted-foreground">Orders without a payment screenshot are not held.</p>
              {payErr && <p className="text-xs text-primary">{payErr}</p>}
            </div>
          )}

          {step === "checkout" && (
            <div className="space-y-5">
              <Steps at={1} />
              <section className="space-y-4 rounded-lg border border-border p-4">
                <p className="nav-link">Recipient details</p>
                <Field label="Name (Arabic)" error={errors.name}>
                  <div className="grid grid-cols-3 gap-2" dir="rtl">
                    {([["first", "الاسم"], ["father", "اسم الأب"], ["family", "الكنية"]] as const).map(([k, ph]) => (
                      <input key={k} className="field" dir="rtl" lang="ar" placeholder={ph} value={form[k]} autoComplete="off"
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\u0600-\u06FF]/g, "");
                          const n = { ...form, [k]: v };
                          n.name = [n.first, n.father, n.family].map((x) => x.trim()).filter(Boolean).join(" ");
                          setForm(n); saveCustomer(n);
                        }} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Write your full name in Arabic — the shipping company needs it for delivery.</p>
                </Field>
                <Field label="Phone" error={errors.phone}><input className="field" type="tel" inputMode="tel" placeholder="09XXXXXXXX" maxLength={10} value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} autoComplete="tel" /></Field>
              </section>
              <section className="space-y-4 rounded-lg border border-border p-4">
                <p className="nav-link">Delivery</p>
                <Field label="Shipping company">
                  <select className="field" value={form.company} onChange={(e) => { const n = { ...form, company: e.target.value, area: "", branch: "" }; setForm(n); saveCustomer(n); }}>
                    {SHIPPING_COMPANIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Governorate" error={errors.governorate}>
                  <select className="field" value={form.governorate} onChange={(e) => { const n = { ...form, governorate: e.target.value, area: "", branch: "" }; setForm(n); saveCustomer(n); }}>
                    <option value="">Select…</option>
                    {GOVERNORATES.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </Field>
                {form.governorate && areasFor(form.company, form.governorate).length > 1 && (
                  <Field label="City / area" error={errors.area}>
                    <select className="field" dir="auto" value={form.area} onChange={(e) => { const n = { ...form, area: e.target.value, branch: "" }; setForm(n); saveCustomer(n); }}>
                      <option value="">Select…</option>
                      {areasFor(form.company, form.governorate).map((a) => <option key={a}>{a}</option>)}
                    </select>
                  </Field>
                )}
                {form.governorate && areaOf(form) && (
                  <Field label={`${companyName(form.company)} branch`} error={errors.branch}>
                    <select className="field" dir="auto" value={form.branch} onChange={(e) => update("branch", e.target.value)}>
                      <option value="">Select…</option>
                      {branchesFor(form.company, form.governorate, areaOf(form)).map((b) => <option key={b}>{b}</option>)}
                    </select>
                  </Field>
                )}
                {form.branch === OTHER_BRANCH && (
                  <Field label="Shipping details" error={errors.shipDetails}>
                    <textarea className="field min-h-16 py-3" dir="auto" placeholder="Branch name or any extra shipping details" value={form.shipDetails} onChange={(e) => update("shipDetails", e.target.value)} />
                  </Field>
                )}
                <Field label="Notes (optional)"><textarea className="field min-h-16 py-3" value={form.notes} onChange={(e) => update("notes", e.target.value)} /></Field>
              </section>
            </div>
          )}
        </div>

        {s.lines.length > 0 && step !== "history" && (
          <footer className="shrink-0 border-t border-border px-5 py-5">
            {step !== "cart" && (
              <div className="mb-3">
                {applied ? (
                  <div className="flex items-center justify-between text-sm">
                    <span>Coupon <b className="font-mono">{applied.code}</b> (−{money(discount)})</span>
                    <button className="text-xs underline" onClick={() => { setApplied(null); setCouponMsg(""); }}>Remove</button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border">
                    <button type="button" aria-expanded={promoOpen} onClick={() => { setPromoOpen((o) => !o); setCouponMsg(""); }} className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50">
                      <span className="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>Have a promo code?</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${promoOpen ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    {promoOpen && (
                      <div className="flex gap-2 border-t border-dashed border-border p-3 animate-in fade-in slide-in-from-top-1">
                        <input autoFocus className="field h-10 flex-1 font-mono uppercase" placeholder="Enter code" value={couponIn} onChange={(e) => setCouponIn(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") tryCoupon(); }} />
                        <button className="btn btn-primary h-10 px-4" onClick={tryCoupon}>Apply</button>
                      </div>
                    )}
                  </div>
                )}
                {couponMsg && <p className="mt-1 text-xs text-primary">{couponMsg}</p>}
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="nav-link">{discount ? "Total" : "Subtotal"}</span>
              <span className="text-lg font-semibold">{discount > 0 && <s className="mr-2 text-sm opacity-60">{money(subtotal)}</s>}{money(total)}</span>
            </div>
            <p className="mt-2 text-xs text-foreground">Pay online and upload your receipt to place the order.</p>
            {errors.sizes && <p className="mt-2 text-xs text-primary">{errors.sizes}</p>}
            {overStock.map((o) => (
              <p key={o.name + o.size} className="mt-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs font-medium text-primary">
                {o.left === 0 ? `${o.name}${o.size ? ` (size ${o.size})` : ""} is sold out. Remove it from your cart to continue.` : `Only ${o.left} left of ${o.name}${o.size ? ` (size ${o.size})` : ""} — you have ${o.want} in your cart. Reduce the quantity to continue.`}
              </p>
            ))}
            {step === "cart" ? (
              <button
                onClick={() => { if (overStock.length) return; if (missingSize) setErrors({ sizes: "Choose a size for every item" }); else { setErrors({}); setStep("checkout"); } }}
                disabled={overStock.length > 0}
                className="btn btn-primary mt-4 w-full disabled:opacity-50"
              >Checkout</button>
            ) : step === "checkout" ? (
              <button onClick={submit} disabled={overStock.length > 0} className="btn mt-4 disabled:opacity-50 w-full bg-success text-success-foreground hover:opacity-90">Pay & Checkout</button>
            ) : step === "pay" ? (
              <button onClick={send} disabled={busy || !receipt || overStock.length > 0} className="btn mt-4 w-full bg-success text-success-foreground hover:opacity-90 disabled:opacity-50">
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

// Short two-note "payment done" chime, synthesized so there's no file to load.
function playDoneChime() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    ([[880, 0], [1318.5, 0.12]] as const).forEach(([f, at]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      const t = ctx.currentTime + at;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.65);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch { /* sound is optional */ }
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
          <span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] ${i + 1 < at ? "bg-primary text-primary-foreground" : i + 1 === at ? "border border-primary text-primary" : "border border-border"}`}>{i + 1 < at ? <Check size={12} strokeWidth={2} /> : i + 1}</span>
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
      ><X size={18} strokeWidth={1.75} /></div>
    </div>
  );
}
