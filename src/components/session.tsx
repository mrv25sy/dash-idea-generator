import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

type SessionState = { session: Session | null; loading: boolean };

const SessionContext = createContext<SessionState>({
  session: null,
  loading: true,
});

const RETURN_PATHS = ["/", "/goals"] as const;
type ReturnPath = (typeof RETURN_PATHS)[number];

const RETURN_KEY = "dash-return";

/** Where a fresh sign-in should land, validated against known app routes. */
function takeReturnPath(): ReturnPath | null {
  const raw = window.sessionStorage.getItem(RETURN_KEY);
  window.sessionStorage.removeItem(RETURN_KEY);
  return RETURN_PATHS.includes(raw as ReturnPath) ? (raw as ReturnPath) : null;
}

/**
 * The app's one and only auth-state listener. Keeps session state for the UI,
 * refreshes router/loader data and cached queries on real transitions, and
 * sends a freshly signed-in visitor to the page they came from.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const router = useRouter();

  const applySession = useCallback(
    (event: string, nextSession: Session | null) => {
      setSession(nextSession);
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED"
      ) {
        return;
      }
      if (event === "SIGNED_IN") {
        const target = takeReturnPath();
        if (target) void router.navigate({ to: target, replace: true });
      }
      void router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    },
    [router, queryClient],
  );

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        applySession(event, nextSession);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [applySession]);

  return (
    <SessionContext.Provider value={{ session, loading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
