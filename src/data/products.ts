// Single source of truth for store content. Everything here is PLACEHOLDER — edit freely.
import nysc from "@/assets/p-nysc.jpg";
import cap from "@/assets/p-cap.jpg";
import sakura from "@/assets/p-sakura.jpg";
import lastDance from "@/assets/p-lastdance.jpg";
import hoodieMidnight from "@/assets/p-hoodie-midnight.jpg";
import hoodieScript from "@/assets/p-hoodie-script.jpg";

export type Color = { name: string; hex: string };
export type Product = {
  id: string;
  name: string;
  price: number;
  images: string[];
  colors: Color[];
  sizes: string[];
  category: string;
  /** "single", "drop", or "section:<Name>" for a custom homepage section. */
  type: string;
  dropName?: string | undefined;
  inStock: boolean;
  comingSoon?: boolean;
  badge?: string | undefined;
  description?: string | undefined;
  details?: { label: string; value: string }[];
  salePrice?: number | undefined;
};

/** Price the customer pays: the sale price when one is set below the regular price. */
export const finalPrice = (p: Pick<Product, "price" | "salePrice">) =>
  p.salePrice != null && p.salePrice < p.price ? p.salePrice : p.price;
export const onSale = (p: Pick<Product, "price" | "salePrice">) => finalPrice(p) < p.price;

const BLACK = { name: "Black", hex: "#0d0d0d" };
const WHITE = { name: "White", hex: "#f2f2f2" };
const RED = { name: "Crimson", hex: "#c30023" };
const GREY = { name: "Washed grey", hex: "#4a4a4a" };
const TEE_SIZES = ["S", "M", "L", "XL", "XXL"];
const HOODIE_SIZES = ["S", "M", "L", "XL", "XXL"];

export const singleCategories: { category: string; label: string }[] = [
  { category: "hoodie", label: "Hoodies" },
  { category: "tee", label: "T-shirts" },
  { category: "cap", label: "Caps" },
];

export const products: Product[] = [
  { id: "ny-soul-club", name: "New York Soul Club Tee", price: 25, images: [nysc], colors: [BLACK, WHITE], sizes: TEE_SIZES, category: "tee", type: "single", inStock: true, badge: "New" },
  { id: "extraordinary-cap", name: "Extraordinary Cap", price: 15, images: [cap], colors: [BLACK, RED], sizes: ["One size"], category: "cap", type: "single", inStock: true },
  { id: "sakura-tee", name: "Sakura Tee", price: 27, images: [sakura], colors: [WHITE, BLACK], sizes: TEE_SIZES, category: "tee", type: "single", inStock: false },
  { id: "last-dance-tee", name: "The Last Dance Tee", price: 28, images: [lastDance], colors: [GREY, BLACK], sizes: TEE_SIZES, category: "tee", type: "single", inStock: true },
  { id: "after-midnight-hoodie", name: "After Midnight Hoodie", price: 45, images: [hoodieMidnight], colors: [BLACK, GREY], sizes: HOODIE_SIZES, category: "hoodie", type: "single", inStock: true, badge: "New" },
  { id: "vice-script-hoodie", name: "Vice Script Hoodie", price: 48, images: [hoodieScript], colors: [GREY, BLACK], sizes: HOODIE_SIZES, category: "hoodie", type: "single", inStock: true, salePrice: 40, description: "Charcoal hoodie with red Vice script embroidery." },
  { id: "night-runner-hoodie", name: "Night Runner Hoodie", price: 50, images: [hoodieMidnight], colors: [BLACK], sizes: ["M", "L", "XL"], category: "hoodie", type: "single", inStock: true, comingSoon: true, description: "Oversized hoodie, arriving soon." },
  { id: "street-signal-tee", name: "Street Signal Tee", price: 22, images: [nysc], colors: [WHITE], sizes: ["S", "M", "L", "XL"], category: "tee", type: "single", inStock: true, description: "Everyday tee with a small chest logo." },
  { id: "crimson-dad-cap", name: "Crimson Dad Cap", price: 14, images: [cap], colors: [RED], sizes: ["One size"], category: "cap", type: "single", inStock: true, salePrice: 11, description: "Unstructured washed cap." },
  // Drop pieces
  { id: "d-soul-night", name: "Soul Night Tee", price: 30, images: [nysc], colors: [BLACK], sizes: TEE_SIZES, category: "tee", type: "drop", dropName: "Night Shift", inStock: true, badge: "Drop" },
  { id: "d-crimson-cap", name: "Crimson Script Cap", price: 18, images: [cap], colors: [BLACK, RED], sizes: ["One size"], category: "cap", type: "drop", dropName: "Night Shift", inStock: true, badge: "Drop" },
  { id: "d-bloom", name: "Bloom Back Tee", price: 32, images: [sakura], colors: [WHITE], sizes: TEE_SIZES, category: "tee", type: "drop", dropName: "Night Shift", inStock: false, comingSoon: true },
  { id: "d-23", name: "Twenty Three Tee", price: 32, images: [lastDance], colors: [GREY], sizes: TEE_SIZES, category: "tee", type: "drop", dropName: "Night Shift", inStock: true, badge: "Drop" },
];

export type Drop = { name: string; tagline: string; cover: string };
// Sample drops (placeholders) — edit names, descriptions and cover photos freely.
export const drops: Drop[] = [
  { name: "Night Shift", tagline: "Made for the hours after midnight.", cover: cap },
  { name: "Sakura Season", tagline: "Soft blooms, loud streets. A spring capsule.", cover: sakura },
  { name: "The Last Dance", tagline: "A tribute to the legends of the court.", cover: lastDance },
  { name: "After Hours", tagline: "Heavyweight hoodies for cold city nights.", cover: hoodieMidnight },
];
export const activeDrop = drops[0];

export type Bundle = { id: string; name: string; productIds: string[]; price: number };
export const bundles: Bundle[] = [
  { id: "soul-fit", name: "The Soul Fit", productIds: ["ny-soul-club", "extraordinary-cap"], price: 34 },
  { id: "court-fit", name: "The Court Fit", productIds: ["last-dance-tee", "extraordinary-cap"], price: 37 },
  { id: "full-fit", name: "The Full Rotation", productIds: ["ny-soul-club", "last-dance-tee", "extraordinary-cap"], price: 58 },
];


export const getProduct = (id: string) => products.find((p) => p.id === id);

// ---- Live catalog: products & bundles are managed from /admin and loaded from the database.
// The arrays above are the offline fallback; they're replaced in place once the database answers.
import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/store-db";

export const ASSET_IMAGES: Record<string, string> = {
  nysc, cap, sakura, lastdance: lastDance, "hoodie-midnight": hoodieMidnight, "hoodie-script": hoodieScript,
};
export const resolveImage = (s: string) => (s.startsWith("asset:") ? ASSET_IMAGES[s.slice(6)] ?? "" : s);

let version = 0;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();

export function loadCatalog(force = false): Promise<void> {
  if (loading && !force) return loading;
  loading = (async () => {
    const [pr, br] = await Promise.all([
      supabase.from("products").select("*").order("sort").order("created_at"),
      supabase.from("bundles").select("*").order("sort").order("created_at"),
    ]);
    // An empty online catalog keeps the sample products below so the shop never looks blank.
    if (pr.error || br.error || !pr.data || pr.data.length === 0) return;
    products.splice(0, products.length, ...pr.data.map((r) => ({
      id: r.id, name: r.name, price: Number(r.price),
      images: (r.images ?? []).map(resolveImage).filter(Boolean),
      colors: (r.colors as Color[]) ?? [], sizes: r.sizes ?? [],
      category: r.category as Product["category"], type: r.type as Product["type"],
      dropName: r.drop_name ?? undefined, inStock: r.in_stock, comingSoon: r.coming_soon, badge: r.badge ?? undefined,
      description: r.description ?? undefined, details: (r.details as { label: string; value: string }[]) ?? [], salePrice: r.sale_price == null ? undefined : Number(r.sale_price),
    })));
    bundles.splice(0, bundles.length, ...(br.data ?? []).map((b) => ({ id: b.id, name: b.name, productIds: b.product_ids ?? [], price: Number(b.price) })));
    version++;
    subs.forEach((f) => f());
  })().catch(() => {});
  return loading;
}

export function useCatalogVersion() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version, () => 0);
}
