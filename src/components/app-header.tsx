import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";

import { useSession } from "@/components/session";
import { supabase } from "@/integrations/supabase/client";

const linkBase =
  "font-mono text-xs tracking-[0.18em] uppercase transition-colors";

export function AppHeader() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-6 py-5">
      <Link
        to="/"
        className="font-display text-sm font-semibold tracking-[0.28em] text-timer-accent uppercase"
      >
        Dash
      </Link>
      <nav className="flex items-center gap-6">
        <Link
          to="/"
          className={`${linkBase} ${
            pathname === "/"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Timer
        </Link>
        <Link
          to="/goals"
          className={`${linkBase} ${
            pathname === "/goals"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Goals
        </Link>
        {loading ? (
          <span className="h-3 w-14 animate-pulse rounded-full bg-muted" />
        ) : session ? (
          <button
            onClick={handleSignOut}
            className={`${linkBase} text-muted-foreground hover:text-foreground`}
          >
            Sign out
          </button>
        ) : (
          <Link
            to="/auth"
            className={`${linkBase} text-muted-foreground hover:text-foreground`}
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
