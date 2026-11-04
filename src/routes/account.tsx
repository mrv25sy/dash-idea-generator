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
import { customerNumber } from "@/lib/coupons";

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
      {session ? <Profile session={session} /> : <><AuthForm /><DeviceOrders /></>}
      <p className="mt-10 text-center text-sm text-muted-foreground">An account is optional — you can always order as a guest. <Link to="/shop" className="text-primary underline">Back to shop</Link></p>
    </main>
  );
}

const cleanUsername = (s: string) => s.toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 20);

function ChangePassword({ email }: { email: string }) {
  const [cur, setCur] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg("");
    if (a.length < 6) return setMsg("New password must be at least 6 characters.");
    if (a !== b) return setMsg("Passwords do not match.");
    setBusy(true);
    // Confirm the current password first so only the account owner can change it.
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: cur });
    if (authErr) { setBusy(false); return setMsg("Current password is wrong."); }
    const { error } = await supabase.auth.updateUser({ password: a, current_password: cur } as any);
    setBusy(false);
    if (error) return setMsg(error.message);
    setCur(""); setA(""); setB(""); setMsg("Password updated ✓");
  };
  if (!open) return (
    <section className="flex items-center justify-between border border-border p-5">
      <h2 className="nav-link">Password</h2>
      <button type="button" onClick={() => { setOpen(true); setMsg(""); }} className="border border-border px-4 py-2 text-sm font-semibold uppercase hover:bg-muted">Change password</button>
    </section>
  );
  return (
    <form onSubmit={submit} className="space-y-3 border border-border p-5">
      <div className="flex items-center justify-between">
        <h2 className="nav-link">Change password</h2>
        <button type="button" onClick={() => { setOpen(false); setCur(""); setA(""); setB(""); }} className="text-sm text-muted-foreground underline">Cancel</button>
      </div>
      <input className={input} type="password" required placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} />
      <input className={input} type="password" required minLength={6} placeholder="New password" value={a} onChange={(e) => setA(e.target.value)} />
      <input className={input} type="password" required minLength={6} placeholder="Confirm new password" value={b} onChange={(e) => setB(e.target.value)} />
      <div className="flex items-center gap-3">
        <button disabled={busy} className="bg-primary px-5 py-2 font-semibold uppercase text-primary-foreground disabled:opacity-60">{busy ? "…" : "Update password"}</button>
        <span className="text-sm text-muted-foreground">{msg}</span>
      </div>
    </form>
  );
}

function AuthForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female">("");
  const [upStep, setUpStep] = useState<1 | 2>(1);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeStep, setCodeStep] = useState(false);
  const [code, setCode] = useState("");
  const saveProfile = async (uid: string) => {
    await storeClient.from("profiles").upsert({ id: uid, full_name: name.trim() || null, phone: phone.trim() || null, updated_at: new Date().toISOString() }, { onConflict: "id" });
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg("");
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      setBusy(false);
      if (error) setMsg(error.message);
      return;
    }
    if (upStep === 1) {
      setBusy(false);
      if (!name.trim() || phone.replace(/\D/g, "").length < 7 || !gender) return setMsg("Enter your name, phone number and choose male or female.");
      setUpStep(2); return;
    }
    if (pw !== pw2) { setBusy(false); return setMsg("Passwords do not match."); }
    const { data, error } = await supabase.auth.signUp({
      email, password: pw,
      options: { emailRedirectTo: `${window.location.origin}/account`, data: { full_name: name.trim(), phone: phone.trim(), gender } },
    });
    if (!error && data.session && data.user) await saveProfile(data.user.id);
    setBusy(false);
    if (error) return setMsg(error.message);
    if (!data.session) { setCodeStep(true); setMsg(""); }
  };
  const resend = async () => {
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/account` } });
    setMsg(error ? error.message : "New confirmation email sent.");
  };
  if (codeStep) return (
    <div className="space-y-4 border border-border p-6">
      <h1 className="font-display text-3xl font-bold uppercase">Check your email</h1>
      <p className="text-sm text-muted-foreground">We sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>. Open it and tap <span className="font-semibold text-foreground">Confirm email address</span> to activate your account. Check your spam folder if you don't see it.</p>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <div className="flex justify-between text-sm">
        <button type="button" onClick={resend} className="text-primary underline">Resend email</button>
        <button type="button" onClick={() => { setCodeStep(false); setMsg(""); }} className="text-primary underline">Change email</button>
      </div>
    </div>
  );
  return (
    <form onSubmit={submit} className="space-y-4 border border-border p-6">
      <h1 className="font-display text-3xl font-bold uppercase">{mode === "in" ? "Sign in" : "Create account"}</h1>
      {mode === "up" && upStep === 1 && (<>
        <p className="text-xs uppercase tracking-[.2em] text-muted-foreground">Step 1 of 2 · About you</p>
        <input className={input} required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} type="tel" required placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          {(["male", "female"] as const).map((g) => (
            <button key={g} type="button" onClick={() => setGender(g)} className={`h-11 border text-sm font-semibold uppercase ${gender === g ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{g === "male" ? "Male" : "Female"}</button>
          ))}
        </div>
      </>)}
      {(mode === "in" || upStep === 2) && (<>
        {mode === "up" && <div className="flex items-center justify-between"><p className="text-xs uppercase tracking-[.2em] text-muted-foreground">Step 2 of 2 · Login details</p><button type="button" onClick={() => setUpStep(1)} className="text-xs text-primary underline">Back</button></div>}
        <input className={input} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" required minLength={6} placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {mode === "up" && <input className={input} type="password" required minLength={6} placeholder="Confirm password" value={pw2} onChange={(e) => setPw2(e.target.value)} />}
      </>)}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <button disabled={busy} className="w-full bg-primary py-3 font-semibold uppercase text-primary-foreground disabled:opacity-60">{busy ? "…" : mode === "in" ? "Sign in" : upStep === 1 ? "Next" : "Sign up"}</button>
      <button type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setUpStep(1); setMsg(""); }} className="w-full text-sm text-primary underline">
        {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
      </button>
    </form>
  );
}

type Order = { order_code: string; status: string; total: number; created_at: string };

// Orders placed as a guest are remembered on this device; live status comes from the store.
function DeviceOrders() {
  const [list, setList] = useState<{ id: string; date: string; total: number; items: string[]; status: string; token?: string }[]>([]);
  const [live, setLive] = useState<Record<string, string>>({});
  useEffect(() => {
    let h: typeof list = [];
    try { h = JSON.parse(localStorage.getItem("vice-order-history") || "[]"); } catch { h = []; }
    if (!Array.isArray(h) || !h.length) return;
    setList(h);
    void (supabase.rpc as any)("order_statuses", { tokens: h.map((o) => o.token).filter(Boolean) }).then(({ data }: { data: { order_code: string; status: string }[] | null }) => {
      setLive(Object.fromEntries((data ?? []).map((r) => [r.order_code, r.status])));
    });
  }, []);
  if (!list.length) return null;
  return (
    <section className="mt-8 space-y-3">
      <h2 className="nav-link">Orders on this device</h2>
      <p className="text-xs text-muted-foreground">Orders you placed without an account. Open the cart → My orders for receipts and cancelling.</p>
      <ul className="divide-y divide-border border border-border">
        {list.map((o) => (
          <li key={o.id} className="flex items-center justify-between p-3 text-sm">
            <div><p className="font-semibold">{o.id}</p><p className="text-muted-foreground">{o.date} · {money(Number(o.total))}</p></div>
            <StatusBadge s={normStatus(live[o.id] ?? o.status ?? "Pending")} />
          </li>
        ))}
      </ul>
    </section>
  );
}

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
    const [{ data: prof }, { data: ord }, { data: u }] = await Promise.all([
      storeClient.from("profiles").select("*").eq("id", uid).maybeSingle(),
      storeClient.from("orders").select("order_code,status,total,created_at").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.auth.getUser(),
    ]);
    // Account details are also kept on the sign-in account itself, so they survive even if the profile row can't be written.
    const meta = (u?.user?.user_metadata ?? session.user.user_metadata ?? {}) as Record<string, string | undefined>;
    const pr = (prof ?? {}) as Record<string, string | null | undefined>;
    const pick = (k: string) => pr[k] || meta[k] || "";
    setP({ full_name: pick("full_name"), phone: pick("phone"), governorate: pick("governorate"), address: pick("address"), avatar_url: pick("avatar_url") });
    setOrders(ord ?? []);
  };
  useEffect(() => { void load(); }, [uid]);
  const save = async (next = p, quiet = false) => {
    const clean = { full_name: next.full_name.trim(), phone: next.phone.trim(), governorate: next.governorate, address: next.address.trim(), avatar_url: next.avatar_url };
    const { error: metaErr } = await supabase.auth.updateUser({ data: clean });
    const row = { id: uid, full_name: clean.full_name || null, phone: clean.phone || null, governorate: clean.governorate || null, address: clean.address || null, updated_at: new Date().toISOString() };
    let { error } = await storeClient.from("profiles").upsert({ ...row, avatar_url: clean.avatar_url || null }, { onConflict: "id" });
    if (error) ({ error } = await storeClient.from("profiles").upsert(row, { onConflict: "id" }));
    if (error) ({ error } = await storeClient.from("profiles").upsert({ id: uid, full_name: row.full_name, phone: row.phone }, { onConflict: "id" }));
    if (quiet) return;
    const failed = metaErr && error;
    setSaved(failed ? `Couldn't save: ${(error ?? metaErr)!.message}` : "Saved ✓");
    setTimeout(() => setSaved(""), failed ? 6000 : 2000);
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
          <p className="truncate font-semibold">{p.full_name || "Your name"} <span className="ml-1 bg-primary px-1.5 py-0.5 font-mono text-[11px] text-primary-foreground">#{customerNumber(uid)}</span></p>
          <p className="truncate text-sm text-muted-foreground">{session.user.email}</p>
          <p className="text-xs text-muted-foreground">Your customer number — share it with us for personal offers.</p>
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
      <ChangePassword email={session.user.email ?? ""} />
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
