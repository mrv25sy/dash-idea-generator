import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { storeClient, type BroadcastRow } from "@/lib/store-client";

const SEEN_KEY = "vice_inbox_seen";

/** Navbar inbox: store messages for every visitor, signed in or not. */
export function InboxButton() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<BroadcastRow[]>([]);
  const [seen, setSeen] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const { data } = await storeClient.from("broadcast_messages").select("*").order("created_at", { ascending: false });
    setMsgs(data ?? []);
    setLoading(false);
  };
  useEffect(() => { setSeen(localStorage.getItem(SEEN_KEY) ?? ""); void load(); }, []);
  useEffect(() => {
    if (!open) return;
    void load();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const unread = msgs.filter((m) => !seen || m.created_at > seen).length;
  const markRead = () => {
    const latest = msgs[0]?.created_at ?? new Date().toISOString();
    localStorage.setItem(SEEN_KEY, latest);
    setSeen(latest);
  };
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={`Inbox, ${unread} new`} className="relative p-2 text-foreground">
        <Mail size={22} strokeWidth={1.6} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{unread}</span>}
      </button>
      {open && <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm" onClick={() => setOpen(false)} />}
      <aside role="dialog" aria-label="Inbox" aria-hidden={!open}
        className={`fixed right-0 top-0 z-50 flex h-[100dvh] w-full max-w-md flex-col border-l border-border bg-background transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[.2em]">Inbox {unread > 0 && <span className="ml-2 bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{unread} new</span>}</h2>
          <div className="flex items-center gap-3">
            {unread > 0 && <button onClick={markRead} className="text-xs text-primary underline">Mark all read</button>}
            <button onClick={() => setOpen(false)} aria-label="Close inbox" className="icon-btn">✕</button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && !msgs.length ? <p className="text-sm text-muted-foreground">Loading…</p> : msgs.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No messages yet. Store news and updates will show up here.</p>
          ) : (
            <ul className="space-y-3">
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
          )}
        </div>
      </aside>
    </>
  );
}
