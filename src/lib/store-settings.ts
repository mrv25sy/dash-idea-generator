import { useEffect, useState } from "react";
import { supabase } from "@/lib/store-client";
import { storeClient } from "@/lib/store-client";
import { PAYMENT_ADDRESS, PAYMENT_NAME } from "@/config";
import qrAsset from "@/assets/payment-qr-live.asset.json";

export type StoreSettings = { paymentName: string; paymentAddress: string; qrUrl: string };
const fallback: StoreSettings = { paymentName: PAYMENT_NAME, paymentAddress: PAYMENT_ADDRESS, qrUrl: qrAsset.url };

/** Checks a URL actually loads as an image before we show it at checkout. */
function imageLoads(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** Payment info saved in the database (store_settings), with built-in copies as fallback. */
export function useStoreSettings() {
  const [s, setS] = useState<StoreSettings>(fallback);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await storeClient.from("store_settings").select("key,value");
      if (!data || cancelled) return;
      const m = Object.fromEntries(data.map((r) => [r.key, r.value]));
      const name = m["payment_name"] || fallback.paymentName;
      const address = m["payment_address"] || fallback.paymentAddress;
      let qrUrl = fallback.qrUrl;
      if (m["payment_qr_path"]) {
        const { data: signed } = await supabase.storage.from("product-images").createSignedUrl(m["payment_qr_path"], 60 * 60 * 24);
        // Only use the database QR if the file actually loads; otherwise show the bundled one.
        if (signed?.signedUrl && (await imageLoads(signed.signedUrl))) qrUrl = signed.signedUrl;
      }
      if (!cancelled) setS({ paymentName: name, paymentAddress: address, qrUrl });
    })();
    return () => { cancelled = true; };
  }, []);
  return s;
}
