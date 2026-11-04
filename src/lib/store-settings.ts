import { useEffect, useState } from "react";
import { supabase, storeClient } from "@/lib/store-client";
import { PAYMENT_ADDRESS, PAYMENT_NAME } from "@/config";
import qrAsset from "@/assets/payment-qr-live.asset.json";
import { PAYMENT_QR_DATA_URL } from "@/lib/payment-qr-data";

/** One way to pay at checkout. `qr` is stored inside the database value itself, so it never expires. */
export type PaymentMethod = { id: string; label: string; name: string; address: string; note: string; qr: string };
export const PAYMENT_KEY = "payment_methods_json";
export const PAYMENT_HEADER_KEY = "payment_header_text";

const builtIn: PaymentMethod = { id: "sham-cash", label: "Sham Cash", name: PAYMENT_NAME, address: PAYMENT_ADDRESS, note: "", qr: PAYMENT_QR_DATA_URL || qrAsset.url };

export type PaymentSettings = { methods: PaymentMethod[]; header: string };
const fallback: PaymentSettings = { methods: [builtIn], header: "" };

export async function loadPaymentSettings(): Promise<PaymentSettings> {
  const { data } = await storeClient.from("store_settings").select("key,value").in("key", [PAYMENT_KEY, PAYMENT_HEADER_KEY, "payment_name", "payment_address", "payment_qr_path"]);
  if (!data) return fallback;
  const m = Object.fromEntries(data.map((r) => [r.key, r.value]));
  const header = m[PAYMENT_HEADER_KEY] ? String(JSON.parse(m[PAYMENT_HEADER_KEY])) : "";
  try {
    const list = m[PAYMENT_KEY] ? (JSON.parse(m[PAYMENT_KEY]) as PaymentMethod[]) : [];
    if (list.length) return { methods: list.map((x) => ({ ...x, qr: x.qr || builtIn.qr })), header };
  } catch { /* fall through */ }
  // Older single-method settings
  const legacy = { ...builtIn, name: m["payment_name"] || builtIn.name, address: m["payment_address"] || builtIn.address };
  if (m["payment_qr_path"]) {
    const { data: signed } = await supabase.storage.from("product-images").createSignedUrl(m["payment_qr_path"], 60 * 60 * 24);
    if (signed?.signedUrl && (await imageLoads(signed.signedUrl))) legacy.qr = signed.signedUrl;
  }
  return { methods: [legacy], header };
}

export async function savePaymentSettings(s: PaymentSettings) {
  const now = new Date().toISOString();
  const { error } = await storeClient.from("store_settings").upsert([
    { key: PAYMENT_KEY, value: JSON.stringify(s.methods), updated_at: now },
    { key: PAYMENT_HEADER_KEY, value: JSON.stringify(s.header), updated_at: now },
  ]);
  return error?.message ?? null;
}

function imageLoads(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** Payment methods for checkout, with the built-in QR as the fallback. */
export function usePaymentSettings() {
  const [s, setS] = useState<PaymentSettings>(fallback);
  useEffect(() => {
    let cancelled = false;
    loadPaymentSettings().then((v) => { if (!cancelled) setS(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return s;
}

/** Shrinks an uploaded QR into a compact image string that can live in the database. */
export function fileToCompactDataUrl(f: File, max = 700): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(f);
  });
}
