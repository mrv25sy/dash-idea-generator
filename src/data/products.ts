// Single source of truth for store content. Everything here is PLACEHOLDER — edit freely.
import nysc from "@/assets/p-nysc.jpg";
import cap from "@/assets/p-cap.jpg";
import sakura from "@/assets/p-sakura.jpg";
import lastDance from "@/assets/p-lastdance.jpg";
import hoodieMidnight from "@/assets/p-hoodie-midnight.jpg";
import hoodieScript from "@/assets/p-hoodie-script.jpg";
import crewBanner from "@/assets/vice-crew-banner.jpg";

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

export type Drop = { name: string; tagline: string; cover: string; endsAt?: string | null; archived?: boolean };
/** A drop is closed once its timer has passed: shown blurred and not shoppable. */
export const dropClosed = (d: Drop, now = Date.now()) => !!d.endsAt && new Date(d.endsAt).getTime() <= now;
export const visibleDrops = () => drops.filter((d) => !d.archived);

/** Homepage sections created from the dashboard. Products join one through type "section:<name>". */
export type CustomSection = { name: string; showInNav: boolean; title?: string; eyebrow?: string; description?: string };
export const customSections: CustomSection[] = [];
/** Where a banner sits on the homepage. Banners sharing a spot slide together. */
export const BANNER_PLACEMENTS = [
  { id: "after-hero", label: "Under the top intro" },
  { id: "after-drops", label: "Under Current drops" },
  { id: "after-singles", label: "Under Singles" },
  { id: "after-sections", label: "Under custom sections" },
  { id: "after-bundles", label: "Under Get the Fit" },
  { id: "after-community", label: "At the bottom" },
] as const;
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number]["id"];
export type BannerSize = "s" | "m" | "l" | "xl";
export type Banner = { src: string; placement: BannerPlacement; title?: string; titleSize?: BannerSize; subtitle?: string };
/** Older saves stored plain image URLs; treat them as banners under Current drops. */
export const toBanner = (b: string | Banner): Banner => (typeof b === "string" ? { src: b, placement: "after-drops" } : { ...b, placement: b.placement || "after-drops" });
/** Full-width homepage banners (managed in /admin → Banners). */
export const banners: Banner[] = [{ src: "asset:crew", placement: "after-drops" }];
export const sectionAnchor = (name: string) => `section-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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

/** Photo names are stored in the image URL fragment: "<url>#name=Back view". */
export const imageName = (src: string) => {
  const m = /#name=([^#]*)$/.exec(src);
  return m ? decodeURIComponent(m[1] ?? "") : "";
};
export const withImageName = (src: string, name: string) => {
  const base = src.replace(/#name=[^#]*$/, "");
  return name.trim() ? `${base}#name=${encodeURIComponent(name.trim())}` : base;
};
/** The back-view photo: one named "back", otherwise the second photo. */
export const backImage = (images: string[]) => images.find((s) => /back/i.test(imageName(s))) ?? images[1];

// ---- Live catalog: products & bundles are managed from /admin and loaded from the database.
// The arrays above are the offline fallback; they're replaced in place once the database answers.
import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/store-client";
import { storeClient } from "@/lib/store-client";

export const ASSET_IMAGES: Record<string, string> = {
  nysc, cap, sakura, lastdance: lastDance, "hoodie-midnight": hoodieMidnight, "hoodie-script": hoodieScript, crew: crewBanner,
};
export const resolveImage = (s: string) => {
  if (!s.startsWith("asset:")) return s;
  const [key = "", frag] = s.slice(6).split("#");
  const url = ASSET_IMAGES[key] ?? "";
  return url && frag ? `${url}#${frag}` : url;
};

let version = 0;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();

export function loadCatalog(force = false): Promise<void> {
  if (loading && !force) return loading;
  loading = (async () => {
    const [pr, br, st] = await Promise.all([
      supabase.from("products").select("*").order("sort").order("created_at"),
      supabase.from("bundles").select("*").order("sort").order("created_at"),
      storeClient.from("store_settings").select("key,value").in("key", ["drops_json", "sections_json", "banners_json"]),
    ]);
    const m = Object.fromEntries((st.data ?? []).map((r) => [r.key, r.value]));
    try { if (m["drops_json"]) drops.splice(0, drops.length, ...(JSON.parse(m["drops_json"]) as Drop[]).map((d) => ({ ...d, cover: resolveImage(d.cover) }))); } catch { /* keep samples */ }
    try { if (m["sections_json"]) customSections.splice(0, customSections.length, ...(JSON.parse(m["sections_json"]) as CustomSection[])); } catch { /* ignore */ }
    try { if (m["banners_json"] != null) banners.splice(0, banners.length, ...(JSON.parse(m["banners_json"]) as (string | Banner)[]).map(toBanner)); } catch { /* ignore */ }
    if (st.data?.length) { version++; subs.forEach((f) => f()); }
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
    if (br.data?.length) bundles.splice(0, bundles.length, ...br.data.map((b) => ({ id: b.id, name: b.name, productIds: b.product_ids ?? [], price: Number(b.price) })));
    version++;
    subs.forEach((f) => f());
  })().catch(() => {});
  return loading;
}

export function useCatalogVersion() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version, () => 0);
}
