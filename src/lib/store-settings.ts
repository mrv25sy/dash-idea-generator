import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_ADDRESS, PAYMENT_NAME } from "@/config";
import qrAsset from "@/assets/payment-qr.jpg.asset.json";

export type StoreSettings = { paymentName: string; paymentAddress: string; qrUrl: string };
const fallback: StoreSettings = { paymentName: PAYMENT_NAME, paymentAddress: PAYMENT_ADDRESS, qrUrl: qrAsset.url };

/** Payment info saved in the database (store_settings), with built-in copies as fallback. */
export function useStoreSettings() {
  const [s, setS] = useState<StoreSettings>(fallback);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("store_settings").select("key,value");
      if (!data) return;
      const m = Object.fromEntries(data.map((r) => [r.key, r.value]));
      let qrUrl = fallback.qrUrl;
      if (m["payment_qr_path"]) {
        const { data: signed } = await supabase.storage.from("product-images").createSignedUrl(m["payment_qr_path"], 60 * 60 * 24);
        if (signed?.signedUrl) qrUrl = signed.signedUrl;
      }
      setS({ paymentName: m["payment_name"] || fallback.paymentName, paymentAddress: m["payment_address"] || fallback.paymentAddress, qrUrl });
    })();
  }, []);
  return s;
}
