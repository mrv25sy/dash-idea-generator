import { useEffect, useState } from "react";
import { storeClient, type BroadcastRow } from "@/lib/store-client";

const SEEN_KEY = "vice_inbox_seen";

export function Inbox() {
  const [msgs, setMsgs] = useState<BroadcastRow[]>([]);
  const [seen, setSeen] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const { data } = await storeClient.from("broadcast_messages").select("*").order("created_at", { ascending: false });
    setMsgs(data ?? []);
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
        <p className="text-sm text-muted-foreground">No messages yet. Store news and updates will show up here.</p>
      ) : (
        <>
          {unread === 0 && <p className="text-sm text-muted-foreground">You are up to date ✓</p>}
          <ul className="space-y-2">
            {msgs.map((m) => {
              const isNew = !seen || m.created_at > seen;
              return (
                <li key={m.id} className={`border p-4 ${isNew ? "border-primary" : "border-border"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{m.title}</p>
                    {m.tag && <span className="nav-link text-primary">{m.tag}</span>}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
