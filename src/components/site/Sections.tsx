import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cart } from "@/lib/cart";
import { CURRENCY, DROP_ACTIVE, ORDERING_ENABLED, INSTAGRAM_URL, WHATSAPP_CHANNEL_URL } from "@/config";
import { instaGallery, visibleDrops, customSections, banners, resolveImage, sectionAnchor, bundles, getProduct, products, sortByCategory, onSale, finalPrice, backImage, coverColor, type Product, type BannerPlacement, type BannerSize } from "@/data/products";
import { DropsCarousel } from "./DropsCarousel";
import { RatingStars } from "./RatingStars";
import { FavoriteButton } from "./FavoriteButton";
import { Lock } from "lucide-react";

const price = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(n);

function FadeUp({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
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

export function SoonLock({ big = false }: { big?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/20">
      <div className="flex flex-col items-center gap-2 text-foreground">
        <span className={`grid place-items-center rounded-full border border-border bg-background/80 backdrop-blur ${big ? "h-20 w-20" : "h-14 w-14"}`}>
          <Lock size={big ? 32 : 22} strokeWidth={1.8} />
        </span>
        <span className={`bg-primary px-3 py-1 font-bold uppercase tracking-[.3em] text-primary-foreground ${big ? "text-sm" : "text-[11px]"}`}>Soon</span>
      </div>
    </div>
  );
}

export function ProductCard({ p }: { p: Product }) {
  const available = p.inStock && !p.comingSoon;
  const soon = !!p.comingSoon;
  const onHome = useLocation({ select: (l) => l.pathname === "/" });
  const [pick, setPick] = useState<string | undefined>(undefined);
  const shown = p.colors.find((c) => c.name === pick) ?? coverColor(p.colors);
  const imgs = shown?.images?.length ? shown.images : p.images;
  const back = !soon && imgs.length > 1 ? backImage(imgs) : undefined;
  void onHome;
  return (
    <article className="group glass relative flex flex-col border border-border">
      <Link to="/product/$id" params={{ id: p.id }} className="relative block aspect-square sm:aspect-[4/5] overflow-hidden bg-muted">
        <img src={imgs[0]} alt={p.name} loading="lazy" width={768} height={960} className={`h-full w-full object-cover transition-all duration-700 group-hover:scale-105 ${back ? "group-hover:opacity-0" : ""} ${soon ? "scale-110 blur-[7px]" : ""}`} />
        {back && <img src={back} alt={`${p.name} back view`} loading="lazy" width={768} height={960} className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100" />}
        {soon && <SoonLock />}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
          {soon ? null : !available ? <span className="bg-foreground px-2 py-1 text-[9px] font-semibold uppercase tracking-[.2em] text-background sm:text-[10px]">Sold out</span>
            : onSale(p) ? <span className="bg-destructive px-2 py-1 text-[9px] font-bold uppercase tracking-[.2em] text-destructive-foreground sm:text-[10px]">Sale</span>
            : p.badge ? <span className="bg-primary px-2 py-1 text-[9px] font-semibold uppercase tracking-[.2em] text-primary-foreground sm:text-[10px]">{p.badge}</span> : null}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:gap-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 line-clamp-2 break-words text-xs font-medium sm:text-sm uppercase tracking-wide"><Link to="/product/$id" params={{ id: p.id }} className="hover:text-primary">{p.name}</Link></h3>
          <PriceTag p={p} className="shrink-0 text-xs sm:text-sm" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <RatingStars productId={p.id} compact />
          <FavoriteButton productId={p.id} />
        </div>
        <div className="flex gap-1.5">
          {p.colors.map((c) => (
            <button key={c.name} type="button" title={c.name} aria-label={c.name} onMouseEnter={() => setPick(c.name)} onClick={() => setPick(c.name)}
              className={`grid h-3.5 w-3.5 place-items-center rounded-full border border-border sm:h-5 sm:w-5 ${c.soldOut ? "opacity-40" : ""}`} style={{ background: c.hex }}>
              {c.name === shown?.name && p.colors.length > 1 && <span className="h-1.5 w-1.5 rounded-full border sm:h-2.5 sm:w-2.5 sm:border-2" style={{ borderColor: "#fff" }} />}
            </button>
          ))}
        </div>
        <div className="mt-auto">
          {available ? (
            ORDERING_ENABLED ? (
              <button type="button" onClick={() => cart.addProduct(p)} className="btn btn-ghost h-8 w-full whitespace-nowrap px-2 text-[10px] tracking-[.1em] sm:h-10 sm:text-xs sm:tracking-[.14em]">Add to cart</button>
            ) : (
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost h-8 w-full whitespace-nowrap px-2 text-[10px] tracking-[.1em] sm:h-10 sm:text-xs sm:tracking-[.14em]">Order on Instagram</a>
            )
          ) : !soon ? (
            <button type="button" disabled className="btn btn-ghost h-8 w-full whitespace-nowrap px-2 text-[10px] tracking-[.1em] sm:h-10 sm:text-xs sm:tracking-[.14em] opacity-50">Sold out</button>
          ) : (
            <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary h-auto min-h-10 w-full flex-col gap-0.5 px-2 py-2 tracking-[.14em]"><span>Notify me</span><span className="text-[8px] font-medium normal-case tracking-normal opacity-90">Follow us on the WhatsApp channel</span></a>
          )}
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

const TITLE_SIZE: Record<BannerSize, string> = {
  s: "text-2xl md:text-4xl",
  m: "text-4xl md:text-6xl",
  l: "text-5xl md:text-8xl",
  xl: "text-6xl md:text-9xl",
};

export function CrewBanner({ placement = "after-drops" }: { placement?: BannerPlacement }) {
  const list = banners.filter((b) => b.placement === placement).map((b) => ({ ...b, src: resolveImage(b.src) })).filter((b) => b.src);
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
        {list.map((b, k) => (
          <div key={k} className="relative w-full shrink-0">
            <img src={b.src} alt={b.title || "Vice lookbook"} loading={k === 0 ? "eager" : "lazy"} width={1920} height={710} draggable={false} className="aspect-[4/5] max-h-[80svh] w-full object-cover object-center sm:aspect-[16/9] md:aspect-[2.2/1] md:max-h-none lg:aspect-[2.7/1]" />
            {(b.title || b.subtitle) && (
              <div className="banner-overlay pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                {b.title && <h2 className={`font-display font-black uppercase leading-none tracking-tight ${TITLE_SIZE[b.titleSize ?? "l"]}`}>{b.title}</h2>}
                {b.subtitle && <p className="mt-4 max-w-2xl text-[11px] font-semibold uppercase tracking-[.25em] md:text-sm">{b.subtitle}</p>}
              </div>
            )}
          </div>
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
        {items.length > 0 ? (
          <div className={grid}>{sortByCategory(items).map((p) => <ProductCard key={p.id} p={p} />)}</div>
        ) : (
          <p className="py-6 text-sm text-muted-foreground">No pieces available right now.</p>
        )}
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

export function InstagramSection() {
  const { enabled, title, posts } = instaGallery;
  if (!enabled || posts.length === 0) return null;
  return (
    <section id="instagram" className="mx-auto max-w-7xl px-5 py-16 md:px-8">
      <h2 className="mb-8 text-center font-display text-3xl font-semibold uppercase tracking-tight md:text-4xl">{title}</h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {posts.map((p, i) => (
          <a key={p.src + i} href={p.href || INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="group block overflow-hidden bg-muted">
            <img src={p.src} alt={`Vice on Instagram ${i + 1}`} loading="lazy" className="aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-105" />
          </a>
        ))}
      </div>
    </section>
  );
}
