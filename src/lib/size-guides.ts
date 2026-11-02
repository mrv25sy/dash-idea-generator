// Size guides are a JSON list in store_settings (size_guides_json). All measurements are in cm.
import { storeClient } from "@/lib/store-client";

export type SizeGuide = {
  id: string;
  name: string; // e.g. "Standard hoodie", "Boxy cropped hoodie"
  category: string; // default guide for this category ("" = none)
  productIds: string[]; // specific designs that use this guide (overrides category)
  columns: string[]; // e.g. ["Chest width", "Length"]
  rows: { size: string; values: string[] }[];
  fitNote?: string;
  howToMeasure?: string;
};

export const SIZE_GUIDES_KEY = "size_guides_json";

export const DEFAULT_GUIDES: SizeGuide[] = [{
  id: "default", name: "Standard fit", category: "", productIds: [],
  columns: ["Chest width", "Length"],
  rows: [["S", "52", "70"], ["M", "55", "72"], ["L", "58", "74"], ["XL", "61", "76"], ["XXL", "64", "78"]].map(([size, ...values]) => ({ size: size!, values })),
  fitNote: "Between sizes? Size up for a looser fit.",
  howToMeasure: "Chest: measured flat, armpit to armpit. Length: from the top of the shoulder to the hem.",
}];

/** Pick the guide for a product: a guide assigned to this exact design wins, then the category default, then a guide with no category. */
export function guideFor(guides: SizeGuide[], productId: string, category: string): SizeGuide | null {
  return guides.find((g) => g.productIds.includes(productId))
    ?? guides.find((g) => g.category && g.category.toLowerCase() === category.toLowerCase())
    ?? guides.find((g) => !g.category && g.productIds.length === 0)
    ?? null;
}

export async function loadSizeGuides(): Promise<SizeGuide[]> {
  const { data } = await storeClient.from("store_settings").select("value").eq("key", SIZE_GUIDES_KEY).maybeSingle();
  if (!data?.value) return DEFAULT_GUIDES;
  try { return JSON.parse(data.value) as SizeGuide[]; } catch { return DEFAULT_GUIDES; }
}

export async function saveSizeGuides(guides: SizeGuide[]) {
  const { error } = await storeClient.from("store_settings").upsert({ key: SIZE_GUIDES_KEY, value: JSON.stringify(guides), updated_at: new Date().toISOString() });
  return error?.message ?? "";
}
