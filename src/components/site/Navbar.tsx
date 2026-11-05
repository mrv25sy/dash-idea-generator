import { ShoppingCart, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { InboxButton } from "./InboxButton";
import { ORDERING_ENABLED } from "@/config";
import { cart, cartCount, useCart } from "@/lib/cart";
import { customSections, sectionAnchor, useCatalogVersion } from "@/data/products";
import { supabase } from "@/lib/store-client";

type NavItem = { label: string; to: "/shop" | "/"; search?: { filter: string }; hash?: string };
export const NAV_LINKS: NavItem[] = [
  { label: "Drops", to: "/shop", search: { filter: "drops" } },
  { label: "Singles", to: "/shop", search: { filter: "singles" } },
  { label: "Bundles", to: "/", hash: "fit" },
];
const useNavLinks = (): NavItem[] => {
  useCatalogVersion();
  return [...NAV_LINKS, ...customSections.filter((s) => s.showInNav).map((s) => ({ label: s.name, to: "/" as const, hash: sectionAnchor(s.name) }))];
};

export function Navbar() {
  const [open, setOpen] = useState(false);
  const links = useNavLinks();
  const count = cartCount(useCart().lines);
  const isAdmin = useRouterState({ select: (s) => s.location.pathname.startsWith("/admin") });
  // Green dot on the account icon when signed in, grey when not.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSignedIn(!!sess));
    return () => sub.subscription.unsubscribe();
  }, []);
  return (
    <header className="glass sticky top-0 z-40 border-b border-border">
      <nav className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link to="/" hash="" aria-label="Vice home" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Logo className="h-9 w-5 shrink-0" /></Link>
        <ul className="absolute left-1/2 hidden -translate-x-1/2 gap-10 md:flex">
          {links.map((l) => (
             <li key={l.label}><Link to={l.to} search={l.search ?? {}} hash={l.hash ?? ""} className="nav-link">{l.label}</Link></li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!isAdmin && <Link to="/account" aria-label={signedIn ? "My account (signed in)" : "My account (signed out)"} className="relative p-2 text-foreground">
            <User size={22} strokeWidth={1.6} />
            <span className={`absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-background ${signedIn ? "bg-success" : "bg-muted-foreground"}`} />
          </Link>}
          {!isAdmin && <InboxButton />}
          {ORDERING_ENABLED && !isAdmin && <button onClick={cart.open} aria-label={`Cart, ${count} items`} className="relative p-2 text-foreground">
            <ShoppingCart size={22} strokeWidth={1.6} />
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{count}</span>
          </button>}
          <button aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)} className="p-2 text-foreground md:hidden">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 8h16M4 16h16" />}
            </svg>
          </button>
        </div>
      </nav>
      {open && (
        <ul className="flex flex-col gap-1 border-t border-border px-5 py-6 md:hidden">
          {links.map((l) => (
            <li key={l.label}>
               <Link to={l.to} search={l.search ?? {}} hash={l.hash ?? ""} onClick={() => setOpen(false)} className="block py-3 font-display text-lg font-semibold uppercase tracking-wider">{l.label}</Link>
            </li>
          ))}
          <li className="mt-3 border-t border-border pt-3" />
          <li><Link to="/account" onClick={() => setOpen(false)} className="block py-3 text-sm font-semibold uppercase tracking-[.2em]">My account</Link></li>
          {ORDERING_ENABLED && <li><button onClick={() => { setOpen(false); window.dispatchEvent(new Event("vice:orders")); }} className="block w-full py-3 text-left text-sm font-semibold uppercase tracking-[.2em]">My orders</button></li>}
          <li><Link to="/shipping" onClick={() => setOpen(false)} className="block py-3 text-sm font-semibold uppercase tracking-[.2em]">Shipping & FAQ</Link></li>
        </ul>
      )}
    </header>
  );
}
