import { useEffect, useState } from "react";
import { storeClient, type BroadcastRow } from "@/lib/store-client";
import { packTag, parseIds, unpackTag, type Coupon } from "@/lib/coupons";

const input = "h-11 w-full border border-border bg-background px-3 text-sm outline-none focus:border-primary";

export function BroadcastTab() {
  const [msgs, setMsgs] = useState<BroadcastRow[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("Update");
  const [who, setWho] = useState<"all" | "some">("all");
  const [ids, setIds] = useState("");
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const load = async () => {
    const { data } = await storeClient.from("broadcast_messages").select("*").order("created_at", { ascending: false });
    setMsgs(data ?? []);
  };
  useEffect(() => {
    void load();
    storeClient.from("store_settings").select("value").eq("key", "coupons_json").maybeSingle().then(({ data }) => {
      try { setCoupons(data?.value ? JSON.parse(data.value) : []); } catch { /* none */ }
    });
    const pre = sessionStorage.getItem("vice-msg-to");
    if (pre) { setWho("some"); setIds(pre); sessionStorage.removeItem("vice-msg-to"); }
  }, []);
  const to = parseIds(ids);
  const send = async () => {
    if (!title.trim() || !body.trim()) return setNote("Write a title and a message first.");
    if (who === "some" && !to.length) return setNote("Type at least one customer number, like #48213.");
    setBusy(true); setNote("");
    const { error } = await storeClient.from("broadcast_messages").insert({ title: title.trim(), body: body.trim(), tag: packTag(tag, who === "some" ? to : [], coupon) });
    setBusy(false);
    if (error) return setNote("Couldn't send: " + error.message);
    setTitle(""); setBody(""); setCoupon(""); setIds("");
    setNote(who === "all" ? "Sent to everyone ✓" : `Sent to ${to.length} customer${to.length > 1 ? "s" : ""} ✓`);
    void load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    await storeClient.from("broadcast_messages").delete().eq("id", id);
    void load();
  };
  return (
    <div className="space-y-8">
      <div className="space-y-3 border border-border p-4 sm:p-5">
        <h2 className="nav-link">New message</h2>
        <div className="grid grid-cols-2 border border-border text-[11px] font-semibold uppercase tracking-[.2em]">
          <button onClick={() => setWho("all")} className={`py-2 ${who === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>All users</button>
          <button onClick={() => setWho("some")} className={`py-2 ${who === "some" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Chosen customers</button>
        </div>
        {who === "some" && (
          <div>
            <input className={input} placeholder="Customer numbers, e.g. #48213, #10422" value={ids} onChange={(e) => setIds(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">{to.length ? `Will go to: ${to.map((i) => "#" + i).join(", ")}` : "Find numbers in the Customers tab or on the customer's profile."}</p>
          </div>
        )}
        <input className={input} placeholder="Title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full border border-border bg-background p-3 text-sm outline-none focus:border-primary" rows={5} maxLength={5000} placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <select className={input} value={tag} onChange={(e) => setTag(e.target.value)}>
            {["Update", "New Drop", "Offer", "Notice", ""].map((t) => <option key={t} value={t}>{t || "No tag"}</option>)}
          </select>
          <select className={input} value={coupon} onChange={(e) => setCoupon(e.target.value)}>
            <option value="">No coupon attached</option>
            {coupons.filter((c) => c.active).map((c) => <option key={c.code} value={c.code}>Attach coupon {c.code}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy} onClick={send} className="bg-primary px-5 py-2 font-semibold uppercase text-primary-foreground disabled:opacity-60">{busy ? "Sending…" : who === "all" ? "Send to all users" : "Send to chosen"}</button>
          <span className="text-sm text-muted-foreground">{note}</span>
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="nav-link">Sent messages ({msgs.length})</h2>
        {msgs.map((m) => {
          const t = unpackTag(m.tag);
          return (
            <div key={m.id} className="flex items-start justify-between gap-4 border border-border p-4">
              <div className="min-w-0 break-words">
                <p className="font-semibold">{m.title} {t.tag && <span className="nav-link ml-2 text-primary">{t.tag}</span>}</p>
                <p className="text-xs text-muted-foreground">To: {t.to.length ? t.to.map((i) => "#" + i).join(", ") : "Everyone"}{t.coupon && ` · Coupon ${t.coupon}`}</p>
                <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => remove(m.id)} className="text-sm text-destructive underline">Delete</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
