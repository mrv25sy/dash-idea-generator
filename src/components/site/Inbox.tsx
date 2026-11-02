import { useEffect, useState } from "react";
import { storeClient, type BroadcastRow } from "@/lib/store-client";
import { customerNumber, unpackTag } from "@/lib/coupons";
import { CouponCard } from "./CouponCard";

const SEEN_KEY = "vice_inbox_seen";

export function Inbox() {
  const [msgs, setMsgs] = useState<BroadcastRow[]>([]);
  const [seen, setSeen] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");
  const load = async () => {
    setLoading(true);
    const [{ data }, { data: u }] = await Promise.all([
      storeClient.from("broadcast_messages").select("*").order("created_at", { ascending: false }),
      storeClient.auth.getUser(),
    ]);
    const me = u.user ? customerNumber(u.user.id) : null;
    // Everyone sees "all users" messages; personal ones only reach the chosen customer numbers.
    setMsgs((data ?? []).filter((m: BroadcastRow) => { const t = unpackTag(m.tag).to; return !t.length || (me != null && t.includes(me)); }));
    setLoading(false);
  };
  useEffect(() => {
    setSeen(localStorage.getItem(SEEN_KEY) ?? "");
    void load();
  }, []);
  const unread = msgs.filter((m) => !seen || m.created_at > seen).length;
  const markRead = () => {
    const latest = msgs[0]?.created_at ?? new Date().toISOString();
    localStorage.setItem(SEEN_KEY, latest);
    setSeen(latest);
  };
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="nav-link">Inbox {unread > 0 && <span className="ml-2 bg-primary px-2 py-0.5 text-xs text-primary-foreground">{unread} new</span>}</h2>
        <div className="flex gap-3 text-sm">
          {unread > 0 && <button onClick={markRead} className="text-primary underline">Mark all read</button>}
          <button onClick={load} className="text-primary underline">↻ Refresh</button>
        </div>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : msgs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages yet. Store news and offers will show up here.</p>
      ) : (
        <>
          {unread === 0 && <p className="text-sm text-muted-foreground">You are up to date ✓</p>}
          <ul className="space-y-3">
            {msgs.map((m) => {
              const isNew = !seen || m.created_at > seen;
              const t = unpackTag(m.tag);
              return (
                <li key={m.id} className={`rounded-xl border p-4 ${isNew ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {isNew && <span className="h-2 w-2 rounded-full bg-primary" />}
                    {t.tag && <span className="rounded-full border border-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">{t.tag}</span>}
                    <span className="ml-auto text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="mt-2 text-base font-semibold">{m.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{m.body}</p>
                  {t.coupon && <CouponCard code={t.coupon} />}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
