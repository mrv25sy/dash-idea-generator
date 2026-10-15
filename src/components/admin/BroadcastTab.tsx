import { useEffect, useState } from "react";
import { storeClient, type BroadcastRow } from "@/lib/store-client";

const input = "h-11 w-full border border-border bg-background px-3 text-sm outline-none focus:border-primary";

export function BroadcastTab() {
  const [msgs, setMsgs] = useState<BroadcastRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("Update");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const load = async () => {
    const { data } = await storeClient.from("broadcast_messages").select("*").order("created_at", { ascending: false });
    setMsgs(data ?? []);
  };
  useEffect(() => { void load(); }, []);
  const send = async () => {
    if (!title.trim() || !body.trim()) return setNote("Write a title and a message first.");
    setBusy(true); setNote("");
    const { error } = await storeClient.from("broadcast_messages").insert({ title: title.trim(), body: body.trim(), tag: tag || null });
    setBusy(false);
    if (error) return setNote("Couldn't send: " + error.message);
    setTitle(""); setBody(""); setNote("Sent to all users ✓");
    void load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this message for everyone?")) return;
    await storeClient.from("broadcast_messages").delete().eq("id", id);
    void load();
  };
  return (
    <div className="space-y-8">
      <div className="space-y-3 border border-border p-5">
        <h2 className="nav-link">New message to all users</h2>
        <input className={input} placeholder="Title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full border border-border bg-background p-3 text-sm outline-none focus:border-primary" rows={5} maxLength={5000} placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} />
        <select className={input} value={tag} onChange={(e) => setTag(e.target.value)}>
          {["Update", "New Drop", "Offer", "Notice", ""].map((t) => <option key={t} value={t}>{t || "No tag"}</option>)}
        </select>
        <div className="flex items-center gap-3">
          <button disabled={busy} onClick={send} className="bg-primary px-5 py-2 font-semibold uppercase text-primary-foreground disabled:opacity-60">{busy ? "Sending…" : "Send to all users"}</button>
          <span className="text-sm text-muted-foreground">{note}</span>
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="nav-link">Sent messages ({msgs.length})</h2>
        {msgs.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-4 border border-border p-4">
            <div>
              <p className="font-semibold">{m.title} {m.tag && <span className="nav-link ml-2 text-primary">{m.tag}</span>}</p>
              <p className="whitespace-pre-line text-sm">{m.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
            </div>
            <button onClick={() => remove(m.id)} className="text-sm text-destructive underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
