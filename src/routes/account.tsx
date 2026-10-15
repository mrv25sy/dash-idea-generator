import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/store-client";
import { storeClient } from "@/lib/store-client";
import { GOVERNORATES } from "@/lib/cart";
import { StatusBadge, normStatus } from "@/lib/order-status";
import { CURRENCY } from "@/config";
import { useFavorites } from "@/components/site/FavoriteButton";
import { ProductCard } from "@/components/site/Sections";
import { getProduct, loadCatalog } from "@/data/products";

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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg("");
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      setBusy(false);
      if (error) setMsg(error.message);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email, password: pw,
      options: { emailRedirectTo: `${window.location.origin}/account`, data: { full_name: name.trim(), phone: phone.trim() } },
    });
    if (!error && data.session && data.user) {
      await storeClient.from("profiles").upsert({ id: data.user.id, full_name: name.trim() || null, phone: phone.trim() || null, updated_at: new Date().toISOString() }, { onConflict: "id" });
    }
    setBusy(false);
    if (error) return setMsg(error.message);
    if (!data.session) setMsg("Account created. Check your email to confirm it, then sign in — your name and phone will be saved.");
  };
  return (
    <form onSubmit={submit} className="space-y-4 border border-border p-6">
      <h1 className="font-display text-3xl font-bold uppercase">{mode === "in" ? "Sign in" : "Create account"}</h1>
      {mode === "up" && <input className={input} required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />}
      {mode === "up" && <input className={input} type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />}
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

function Favorites() {
  const { ids } = useFavorites();
  const [, setTick] = useState(0);
  useEffect(() => { void loadCatalog().then(() => setTick((t) => t + 1)); }, []);
  const list = [...ids].map((id) => getProduct(id)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <section className="space-y-3">
      <h2 className="nav-link">My favourites {list.length > 0 && <span className="text-muted-foreground">({list.length})</span>}</h2>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">Tap the heart on any piece to save it here.</p> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{list.map((x) => <ProductCard key={x.id} p={x} />)}</div>
      )}
    </section>
  );
}

function Profile({ session }: { session: Session }) {
  const uid = session.user.id;
  const [p, setP] = useState({ full_name: "", phone: "", governorate: "", address: "", avatar_url: "" });
  const [orders, setOrders] = useState<Order[]>([]);
  const [saved, setSaved] = useState("");
  const [uploading, setUploading] = useState(false);
  const load = async () => {
    const [{ data: prof }, { data: ord }] = await Promise.all([
      storeClient.from("profiles").select("full_name,phone,governorate,address,avatar_url").eq("id", uid).maybeSingle(),
      storeClient.from("orders").select("order_code,status,total,created_at").eq("user_id", uid).order("created_at", { ascending: false }),
    ]);
    const meta = (session.user.user_metadata ?? {}) as { full_name?: string; phone?: string };
    if (prof) setP({ full_name: prof.full_name || meta.full_name || "", phone: prof.phone || meta.phone || "", governorate: prof.governorate ?? "", address: prof.address ?? "", avatar_url: prof.avatar_url ?? "" });
    else if (meta.full_name || meta.phone) {
      // First sign-in after sign-up: store the name/phone given at registration.
      const first = { full_name: meta.full_name ?? "", phone: meta.phone ?? "", governorate: "", address: "", avatar_url: "" };
      setP(first);
      void save(first, true);
    }
    setOrders(ord ?? []);
  };
  useEffect(() => { void load(); }, [uid]);
  const save = async (next = p, quiet = false) => {
    const row = { id: uid, full_name: next.full_name.trim() || null, phone: next.phone.trim() || null, governorate: next.governorate || null, address: next.address.trim() || null, updated_at: new Date().toISOString() };
    let { error } = await storeClient.from("profiles").upsert({ ...row, avatar_url: next.avatar_url || null }, { onConflict: "id" });
    // Older databases may lack the photo column — still save the details.
    if (error && /avatar_url/i.test(error.message)) ({ error } = await storeClient.from("profiles").upsert(row, { onConflict: "id" }));
    if (quiet) return;
    setSaved(error ? `Couldn't save: ${error.message}` : "Saved ✓");
    setTimeout(() => setSaved(""), error ? 6000 : 2000);
  };
  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) return setSaved("Please choose an image.");
    if (file.size > 5 * 1024 * 1024) return setSaved("Photo must be under 5MB.");
    setUploading(true);
    const path = `avatars/${uid}/${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { setUploading(false); return setSaved("Upload failed: " + error.message); }
    const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    setUploading(false);
    if (!data?.signedUrl) return setSaved("Upload failed, try again.");
    const next = { ...p, avatar_url: data.signedUrl };
    setP(next);
    await save(next);
  };
  const initials = (p.full_name || session.user.email || "?").slice(0, 1).toUpperCase();
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold uppercase">My profile</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-primary underline">Sign out</button>
      </div>
      <section className="flex items-center gap-5 border border-border p-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-2xl font-bold">
          {p.avatar_url ? <img src={p.avatar_url} alt="Profile photo" className="h-full w-full object-cover" /> : initials}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{p.full_name || "Your name"}</p>
          <p className="truncate text-sm text-muted-foreground">{session.user.email}</p>
          <label className="mt-2 inline-block cursor-pointer text-sm text-primary underline">
            {uploading ? "Uploading…" : p.avatar_url ? "Change photo" : "Add photo"}
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); e.target.value = ""; }} />
          </label>
        </div>
      </section>
      <section className="space-y-3 border border-border p-5">
        <h2 className="nav-link">My details</h2>
        <input className={input} placeholder="Full name" value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} />
        <input className={input} placeholder="Phone" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} />
        <select className={input} value={p.governorate} onChange={(e) => setP({ ...p, governorate: e.target.value })}>
          <option value="">Governorate</option>
          {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <textarea className={input} rows={3} placeholder="Address" value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} />
        <p className="text-xs text-muted-foreground">For your safety, the address isn't filled in automatically at checkout — you type it for each order.</p>
        <div className="flex items-center gap-3">
          <button onClick={() => save()} className="bg-primary px-5 py-2 font-semibold uppercase text-primary-foreground">Save</button>
          <span className="text-sm text-muted-foreground">{saved}</span>
        </div>
      </section>
      <Favorites />
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
