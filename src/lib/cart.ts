// Client-side cart store, saved in localStorage. No backend.
import { useSyncExternalStore } from "react";
import { bundles, finalPrice, getProduct, type Product } from "@/data/products";

export type Piece = { productId: string; color: string; size: string };
export type CartLine = {
  key: string;
  kind: "single" | "bundle";
  bundleId?: string;
  pieces: Piece[];
  qty: number;
  unitPrice: number;
};
export type Customer = { name: string; phone: string; governorate: string; address: string; notes: string };

type State = { lines: CartLine[]; open: boolean; notices: string[]; restore: CartLine[] | null; ready: boolean };

const CART_KEY = "vice-cart";
const CUSTOMER_KEY = "vice-customer";
const RESTORE_KEY = "vice-cart-restore";
const RESTORE_MS = 5 * 60 * 1000;

let state: State = { lines: [], open: false, notices: [], restore: null, ready: false };
const listeners = new Set<() => void>();
const SERVER: State = state;

function set(patch: Partial<State>, persist = true) {
  state = { ...state, ...patch };
  if (persist && state.ready) localStorage.setItem(CART_KEY, JSON.stringify(state.lines));
  listeners.forEach((l) => l());
}

const available = (p?: Product) => !!p && p.inStock && !p.comingSoon;
const uid = () => Math.random().toString(36).slice(2, 10);

export function priceOf(line: Omit<CartLine, "unitPrice" | "key" | "qty">): number | null {
  if (line.kind === "bundle") return bundles.find((b) => b.id === line.bundleId)?.price ?? null;
  return (() => { const p = getProduct(line.pieces[0]?.productId ?? ""); return p ? finalPrice(p) : null; })();
}

function validate(lines: CartLine[]) {
  const notices: string[] = [];
  const out: CartLine[] = [];
  for (const l of lines) {
    const prods = l.pieces.map((pc) => getProduct(pc.productId));
    const name = l.kind === "bundle" ? bundles.find((b) => b.id === l.bundleId)?.name ?? "A bundle" : prods[0]?.name ?? "An item";
    const price = priceOf(l);
    if (price === null || prods.some((p) => !p)) { notices.push(`${name} is no longer available and was removed.`); continue; }
    if (prods.some((p) => !available(p))) { notices.push(`${name} is sold out and was removed.`); continue; }
    const pieces = l.pieces.map((pc, i) => {
      const p = prods[i]!;
      return {
        ...pc,
        color: p.colors.some((c) => c.name === pc.color) ? pc.color : p.colors[0]?.name ?? "",
        size: p.sizes.includes(pc.size) ? pc.size : p.sizes.length === 1 ? p.sizes[0] ?? "" : "",
      };
    });
    if (price !== l.unitPrice) notices.push(`The price of ${name} changed to $${price}.`);
    out.push({ ...l, pieces, unitPrice: price });
  }
  return { lines: out, notices };
}

export function initCart() {
  if (state.ready) return;
  let lines: CartLine[] = [];
  let restore: CartLine[] | null = null;
  try { lines = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { lines = []; }
  try {
    const r = JSON.parse(localStorage.getItem(RESTORE_KEY) || "null");
    if (r && r.expires > Date.now()) restore = r.lines;
    else localStorage.removeItem(RESTORE_KEY);
  } catch { /* ignore */ }
  const v = validate(Array.isArray(lines) ? lines : []);
  state = { ...state, ready: true };
  set({ lines: v.lines, notices: v.notices, restore });
}

const defaultPiece = (p: Product, color?: string, size?: string): Piece => ({
  productId: p.id,
  color: color ?? p.colors[0]?.name ?? "",
  size: size ?? (p.sizes.length === 1 ? p.sizes[0] ?? "" : ""),
});

function addLine(line: Omit<CartLine, "key">) {
  const sig = JSON.stringify([line.kind, line.bundleId, line.pieces]);
  const existing = state.lines.find((l) => JSON.stringify([l.kind, l.bundleId, l.pieces]) === sig);
  const lines = existing
    ? state.lines.map((l) => (l === existing ? { ...l, qty: Math.min(10, l.qty + line.qty) } : l))
    : [...state.lines, { ...line, key: uid() }];
  set({ lines, open: true, notices: [] });
}

export const cart = {
  addProduct(p: Product, opts: { color?: string | undefined; size?: string | undefined; qty?: number | undefined } = {}) {
    if (!available(p)) return;
    addLine({ kind: "single", pieces: [defaultPiece(p, opts.color, opts.size)], qty: opts.qty ?? 1, unitPrice: finalPrice(p) });
  },
  addBundle(bundleId: string) {
    const b = bundles.find((x) => x.id === bundleId);
    if (!b) return;
    const prods = b.productIds.map(getProduct);
    if (prods.some((p) => !available(p))) return;
    addLine({ kind: "bundle", bundleId, pieces: prods.map((p) => defaultPiece(p!)), qty: 1, unitPrice: b.price });
  },
  setQty(key: string, qty: number) {
    set({ lines: state.lines.map((l) => (l.key === key ? { ...l, qty: Math.max(1, Math.min(10, qty)) } : l)) });
  },
  setPiece(key: string, index: number, patch: Partial<Piece>) {
    set({ lines: state.lines.map((l) => (l.key === key ? { ...l, pieces: l.pieces.map((pc, i) => (i === index ? { ...pc, ...patch } : pc)) } : l)) });
  },
  remove(key: string) { set({ lines: state.lines.filter((l) => l.key !== key) }); },
  open() { set({ open: true }, false); },
  close() { set({ open: false, notices: [] }, false); },
  dismissNotices() { set({ notices: [] }, false); },
  clearAfterOrder() {
    const lines = state.lines;
    localStorage.setItem(RESTORE_KEY, JSON.stringify({ lines, expires: Date.now() + RESTORE_MS }));
    set({ lines: [], restore: lines });
  },
  restore() {
    if (!state.restore) return;
    localStorage.removeItem(RESTORE_KEY);
    const v = validate(state.restore);
    set({ lines: v.lines, notices: v.notices, restore: null, open: true });
  },
  dropRestore() { localStorage.removeItem(RESTORE_KEY); set({ restore: null }, false); },
};

export function useCart() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => SERVER,
  );
}

export const lineTotal = (l: CartLine) => l.unitPrice * l.qty;
export const cartCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.qty * l.pieces.length, 0);

export const emptyCustomer: Customer = { name: "", phone: "", governorate: "", address: "", notes: "" };
export function loadCustomer(): Customer {
  try { return { ...emptyCustomer, ...JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "{}") }; } catch { return emptyCustomer; }
}
export function saveCustomer(c: Customer) { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c)); }

export const GOVERNORATES = [
  "Damascus", "Rif Dimashq", "Aleppo", "Homs", "Hama", "Latakia", "Tartus",
  "Idlib", "Daraa", "As-Suwayda", "Quneitra", "Deir ez-Zor", "Raqqa", "Al-Hasakah",
];
