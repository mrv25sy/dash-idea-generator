import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useSession } from "@/components/session";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Dash" },
      {
        name: "description",
        content: "Sign in to Dash to keep your goals in one private place.",
      },
      { property: "og:title", content: "Sign in — Dash" },
      {
        property: "og:description",
        content: "Sign in to Dash to keep your goals in one private place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function message(error: unknown) {
  return error instanceof Error ? error.message : "That didn't work. Try again.";
}

function AuthPage() {
  const { session, loading } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setNotice("That email address doesn't look right.");
      return;
    }
    if (password.length < 8) {
      setNotice("Use at least 8 characters for your password.");
      return;
    }

    setBusy(true);
    setNotice(null);
    window.sessionStorage.setItem("dash-return", "/goals");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (!data.session)
          setNotice(
            "We sent you a confirmation link. Open it, then come back and sign in.",
          );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    window.sessionStorage.setItem("dash-return", "/goals");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) setNotice("Google sign-in didn't finish. Try again.");
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  if (!loading && session) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          You're signed in
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {session.user.email}
        </p>
        <Link
          to="/goals"
          className="mt-6 inline-flex rounded-full bg-timer-accent px-6 py-3 font-display text-sm font-semibold text-timer-accent-foreground transition-opacity hover:opacity-90"
        >
          Go to my goals
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        {mode === "signin" ? "Sign in to Dash" : "Create your Dash account"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your goals are private to your account.
      </p>

      <button
        onClick={handleGoogle}
        disabled={busy}
        className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-input font-display text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
      >
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-input" />
        <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          or
        </span>
        <span className="h-px flex-1 bg-input" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          autoComplete="email"
          className="h-12 w-full rounded-full border border-input bg-transparent px-5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-timer-accent"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          aria-label="Password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className="h-12 w-full rounded-full border border-input bg-transparent px-5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-timer-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-full bg-timer-accent font-display text-sm font-semibold text-timer-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy
            ? "One moment…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      {notice ? (
        <p className="mt-4 text-center text-sm text-destructive">{notice}</p>
      ) : null}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setNotice(null);
          }}
          className="font-medium text-timer-accent hover:underline"
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
    </main>
  );
}
