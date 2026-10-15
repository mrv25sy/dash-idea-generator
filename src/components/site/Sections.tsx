import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cart } from "@/lib/cart";
import { CURRENCY, DROP_ACTIVE, ORDERING_ENABLED, INSTAGRAM_URL, WHATSAPP_CHANNEL_URL } from "@/config";
import { visibleDrops, customSections, banners, resolveImage, sectionAnchor, bundles, getProduct, products, singleCategories, onSale, finalPrice, type Product } from "@/data/products";
import { DropsCarousel } from "./DropsCarousel";
import { RatingStars } from "./RatingStars";
import { FavoriteButton } from "./FavoriteButton";

const price = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(n);

function FadeUp({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`fade-up ${shown ? "is-in" : ""} ${className}`}>{children}</div>;
}

function SectionHead({ eyebrow, title, link, sub }: { eyebrow?: string; title: string; link?: "drops" | "singles"; sub?: string }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="nav-link mb-2 text-primary">{eyebrow}</p>}
        <h2 className="font-display text-3xl font-semibold uppercase tracking-tight md:text-5xl">{title}</h2>
        {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {link && <Link to="/shop" search={{ filter: link }} className="nav-link whitespace-nowrap hover:text-foreground">See all →</Link>}
    </div>
  );
}

export function PriceTag({ p, className = "" }: { p: Product; className?: string }) {
  if (!onSale(p)) return <span className={`text-muted-foreground ${className}`}>{price(p.price)}</span>;
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className="text-muted-foreground line-through">{price(p.price)}</span>
      <span className="font-bold text-foreground">{price(finalPrice(p))}</span>
    </span>
  );
}

export function ProductCard({ p }: { p: Product }) {
  const available = p.inStock && !p.comingSoon;
  const soon = !!p.comingSoon;
  return (
    <article className="group glass flex flex-col border border-border">
      <Link to="/product/$id" params={{ id: p.id }} className="relative block aspect-[4/5] overflow-hidden">
        <img src={p.images[0]} alt={p.name} loading="lazy" width={768} height={960} className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${soon ? "scale-110 blur-[7px]" : ""}`} />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
          {onSale(p) && <span className="bg-destructive px-2 py-1 text-[10px] font-bold uppercase tracking-[.2em] text-destructive-foreground">Sale</span>}
          {p.badge && <span className=" bg-primary px-2 py-1 text-[10px] font-semibold uppercase tracking-[.2em] text-primary-foreground">{p.badge}</span>}
        </div>
        {!available && <span className="absolute bottom-3 right-3 bg-primary px-2 py-1 text-[10px] font-semibold uppercase tracking-[.2em] text-primary-foreground">{soon ? "Soon" : "Sold out"}</span>}
        <FavoriteButton productId={p.id} className="absolute right-3 top-3" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 break-words text-sm font-medium uppercase tracking-wide"><Link to="/product/$id" params={{ id: p.id }} className="hover:text-primary">{p.name}</Link></h3>
          <PriceTag p={p} className="shrink-0 text-sm" />
        </div>
        <RatingStars productId={p.id} compact />
        <div className="flex gap-1.5">
          {p.colors.map((c) => <span key={c.name} title={c.name} className="h-3.5 w-3.5 rounded-full border border-border" style={{ background: c.hex }} />)}
        </div>
        <div className="mt-auto">
          {available ? (
            ORDERING_ENABLED ? (
              <button type="button" onClick={() => cart.addProduct(p)} className="btn btn-ghost h-10 w-full whitespace-nowrap px-2 tracking-[.14em]">Add to cart</button>
            ) : (
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost h-10 w-full whitespace-nowrap px-2 tracking-[.14em]">Order on Instagram</a>
            )
          ) : !soon ? (
            <button type="button" disabled className="btn btn-ghost h-10 w-full whitespace-nowrap px-2 tracking-[.14em] opacity-50">Sold out</button>
          ) : (
            <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary h-10 w-full whitespace-nowrap px-2 tracking-[.14em]">Notify me</a>
          )}
          <p className="mt-2 h-3 text-center text-[10px] leading-3 text-muted-foreground">{available ? "\u00A0" : "Follow us on the WhatsApp channel"}</p>
        </div>
      </div>
    </article>
  );
}

const wrap = "mx-auto max-w-7xl px-5 py-20 md:py-28";
const grid = "grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4";

export function DropsSection() {
  if (!DROP_ACTIVE || visibleDrops().length === 0) return null;
  return (
    <section id="drops" className={wrap}>
      <FadeUp>
        <SectionHead eyebrow="Drops" title="Current drops" />
        <DropsCarousel />
      </FadeUp>
    </section>
  );
}

/** Custom sections created from the dashboard: products whose type is "section:<Name>". */
export function CustomSections() {
  const fromProducts = products.filter((p) => p.type.startsWith("section:") && p.type.length > 8).map((p) => p.type.slice(8));
  const names = [...new Set([...customSections.map((s) => s.name), ...fromProducts])];
  return (
    <>
      {names.map((n) => {
        const meta = customSections.find((s) => s.name === n);
        return (
        <section key={n} id={sectionAnchor(n)} className={wrap}>
          <FadeUp>
            <SectionHead {...(meta?.eyebrow ? { eyebrow: meta.eyebrow } : {})} title={meta?.title || n} />
            {meta?.description && <p className="-mt-4 mb-8 max-w-3xl whitespace-pre-line text-base leading-relaxed text-muted-foreground">{meta.description}</p>}
            {products.some((p) => p.type === `section:${n}`)
              ? <div className={grid}>{products.filter((p) => p.type === `section:${n}`).map((p) => <ProductCard key={p.id} p={p} />)}</div>
              : !meta?.description && <p className="text-sm text-muted-foreground">New pieces coming soon.</p>}
          </FadeUp>
        </section>
        );
      })}
    </>
  );
}

export function CrewBanner() {
  const list = banners.map(resolveImage).filter(Boolean);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(0);
  const startX = useRef<number | null>(null);
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % list.length), 5000);
    return () => clearInterval(t);
  }, [list.length, paused]);
  if (list.length === 0) return null;
  const go = (d: number) => { setI((n) => (n + d + list.length) % list.length); setPaused((p) => p + 1); };
  return (
    <section className="relative w-full touch-pan-y select-none overflow-hidden" aria-label="Vice lookbook"
      onPointerDown={(e) => { startX.current = e.clientX; }}
      onPointerUp={(e) => { if (startX.current === null) return; const dx = e.clientX - startX.current; startX.current = null; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }}
      onPointerCancel={() => { startX.current = null; }}>
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${(i % list.length) * 100}%)` }}>
        {list.map((src, k) => (
          <img key={k} src={src} alt="Vice crew wearing Vice t-shirts" loading={k === 0 ? "eager" : "lazy"} width={1920} height={710} className="aspect-[2.7/1] w-full shrink-0 object-cover" />
        ))}
      </div>
      {list.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          {list.map((_, k) => (
            <button key={k} type="button" aria-label={`Photo ${k + 1}`} onClick={() => setI(k)} className={`h-1.5 w-6 transition-colors ${k === i % list.length ? "bg-primary" : "bg-foreground/40"}`} />
          ))}
        </div>
      )}
    </section>
  );
}

export function SinglesSection() {
  const items = products.filter((p) => p.type === "single");
  return (
    <section id="singles" className={wrap}>
      <FadeUp>
        <SectionHead eyebrow="Everyday" title="Singles" sub="Hoodies, T-shirts and caps for every day." link="singles" />
        <div className="space-y-12">
          {[...singleCategories, ...[...new Set(items.map((p) => p.category))].filter((c) => !singleCategories.some((x) => x.category === c)).map((c) => ({ category: c, label: c.charAt(0).toUpperCase() + c.slice(1) + "s" }))].map(({ category, label }) => {
            const categoryItems = items.filter((p) => p.category === category);
            return (
              <div key={category}>
                <div className="mb-5 flex items-center gap-4 border-b border-border pb-4">
                  <h3 className="font-display text-2xl font-semibold uppercase">{label}</h3>
                  <span className="text-xs text-muted-foreground">{categoryItems.length} {categoryItems.length === 1 ? "piece" : "pieces"}</span>
                </div>
                {categoryItems.length > 0 ? (
                  <div className={grid}>{categoryItems.map((p) => <ProductCard key={p.id} p={p} />)}</div>
                ) : (
                  <p className="py-6 text-sm text-muted-foreground">No {label.toLowerCase()} available right now.</p>
                )}
              </div>
            );
          })}
        </div>
      </FadeUp>
    </section>
  );
}

export function BundlesSection() {
  return (
    <section id="fit" className={wrap}>
      <FadeUp>
        <SectionHead eyebrow="Bundles" title="Get the Fit" sub="Pieces that go together, for less." />
        <div className="grid gap-5 md:grid-cols-3">
          {bundles.map((b) => {
            const items = b.productIds.map(getProduct).filter(Boolean) as Product[];
            const full = items.reduce((s, p) => s + p.price, 0);
            return (
              <article key={b.id} className="glass flex flex-col border border-border p-4">
                <div className="grid grid-cols-3 gap-2">
                  {items.map((p) => <img key={p.id} src={p.images[0]} alt={p.name} loading="lazy" width={768} height={960} className="aspect-[4/5] w-full object-cover" />)}
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold uppercase">{b.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{items.map((p) => p.name).join(" + ")}</p>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-xl font-semibold">{price(b.price)}</span>
                  <span className="text-sm text-muted-foreground line-through">{price(full)}</span>
                  <span className="ml-auto text-xs font-semibold uppercase tracking-widest text-primary">Save {price(full - b.price)}</span>
                </div>
                {!ORDERING_ENABLED ? (
                  <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-4 w-full">Order on Instagram</a>
                ) : items.every((p) => p.inStock && !p.comingSoon) ? (
                  <button type="button" onClick={() => cart.addBundle(b.id)} className="btn btn-primary mt-4 w-full">Add bundle to cart</button>
                ) : (
                  <button type="button" disabled className="btn btn-ghost mt-4 w-full opacity-50">Sold out</button>
                )}
              </article>
            );
          })}
        </div>
      </FadeUp>
    </section>
  );
}


export function CommunitySection() {
  return (
    <section id="community" className={wrap}>
      <FadeUp>
        <div className="glass border border-border p-8 text-center md:p-16">
          <h2 className="font-display text-3xl font-semibold uppercase tracking-tight md:text-5xl">Join the journey</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">First to know about drops, restocks and new singles.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary">WhatsApp Channel</a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">@vicestoree</a>
          </div>
        </div>
      </FadeUp>
    </section>
  );
}
