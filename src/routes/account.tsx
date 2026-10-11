import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { GOVERNORATES } from "@/lib/cart";
import { StatusBadge, normStatus } from "@/lib/order-status";
import { CURRENCY } from "@/config";

export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My account — Vice" },
      { name: "description", content: "Sign in to Vice to save your delivery details and track all your orders." },
      { property: "og:title", content: "My account — Vice" },
      { property: "og:description", content: "Optional Vice account: saved details and order history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(n);
const input = "w-full border border-border bg-background px-3 py-2 text-sm text-foreground";

function AccountPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!ready) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      {session ? <Profile session={session} /> : <AuthForm />}
      <p className="mt-10 text-center text-sm text-muted-foreground">An account is optional — you can always order as a guest. <Link to="/shop" className="text-primary underline">Back to shop</Link></p>
    </main>
  );
}

function AuthForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg("");
    const { error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password: pw })
      : await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: `${window.location.origin}/account` } });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (mode === "up") setMsg("Account created. Check your email to confirm it, then sign in.");
  };
  return (
    <form onSubmit={submit} className="space-y-4 border border-border p-6">
      <h1 className="font-display text-3xl font-bold uppercase">{mode === "in" ? "Sign in" : "Create account"}</h1>
      <input className={input} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={input} type="password" required minLength={6} placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <button disabled={busy} className="w-full bg-primary py-3 font-semibold uppercase text-primary-foreground disabled:opacity-60">{busy ? "…" : mode === "in" ? "Sign in" : "Sign up"}</button>
      <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-sm text-primary underline">
        {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
      </button>
    </form>
  );
}

type Order = { order_code: string; status: string; total: number; created_at: string };

function Profile({ session }: { session: Session }) {
  const uid = session.user.id;
  const [p, setP] = useState({ full_name: "", phone: "", governorate: "", address: "" });
  const [orders, setOrders] = useState<Order[]>([]);
  const [saved, setSaved] = useState("");
  const load = async () => {
    const [{ data: prof }, { data: ord }] = await Promise.all([
      supabase.from("profiles").select("full_name,phone,governorate,address").eq("id", uid).maybeSingle(),
      supabase.from("orders").select("order_code,status,total,created_at").eq("user_id", uid).order("created_at", { ascending: false }),
    ]);
    if (prof) setP({ full_name: prof.full_name ?? "", phone: prof.phone ?? "", governorate: prof.governorate ?? "", address: prof.address ?? "" });
    setOrders((ord as Order[]) ?? []);
  };
  useEffect(() => { void load(); }, [uid]);
  const save = async () => {
    const { error } = await supabase.from("profiles").upsert({ id: uid, ...p, updated_at: new Date().toISOString() });
    setSaved(error ? "Couldn't save, try again." : "Saved ✓");
    setTimeout(() => setSaved(""), 2000);
  };
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold uppercase">My account</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-primary underline">Sign out</button>
      </div>
      <p className="text-sm text-muted-foreground">{session.user.email}</p>
      <section className="space-y-3 border border-border p-5">
        <h2 className="nav-link">Delivery details (auto-filled at checkout)</h2>
        <input className={input} placeholder="Full name" value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} />
        <input className={input} placeholder="Phone" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} />
        <select className={input} value={p.governorate} onChange={(e) => setP({ ...p, governorate: e.target.value })}>
          <option value="">Governorate</option>
          {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <textarea className={input} rows={3} placeholder="Address" value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} />
        <div className="flex items-center gap-3">
          <button onClick={save} className="bg-primary px-5 py-2 font-semibold uppercase text-primary-foreground">Save</button>
          <span className="text-sm text-muted-foreground">{saved}</span>
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="nav-link">My orders</h2>
          <button onClick={load} className="text-sm text-primary underline">↻ Refresh</button>
        </div>
        {orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders on this account yet. Orders you place while signed in show here.</p> : (
          <ul className="divide-y divide-border border border-border">
            {orders.map((o) => (
              <li key={o.order_code} className="flex items-center justify-between p-3 text-sm">
                <div><p className="font-semibold">{o.order_code}</p><p className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString()} · {money(Number(o.total))}</p></div>
                <StatusBadge s={normStatus(o.status)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
