import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CURRENCY, INSTAGRAM_URL, ORDERING_ENABLED, WHATSAPP_CHANNEL_URL } from "@/config";
import { cart } from "@/lib/cart";
import { getProduct, loadCatalog, onSale, products } from "@/data/products";
import { PriceTag, ProductCard } from "@/components/site/Sections";
import { NotFoundView } from "@/components/site/NotFoundView";

const price = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(n);

// Placeholder size chart (cm) — edit freely.
const SIZE_CHART = [
  ["S", "52", "70"],
  ["M", "55", "72"],
  ["L", "58", "74"],
  ["XL", "61", "76"],
  ["XXL", "64", "78"],
];

export const Route = createFileRoute("/product/$id")({
  loader: async ({ params }) => {
    await loadCatalog();
    const product = getProduct(params.id);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found — Vice" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.product.name} — Vice`;
    const d = `${loaderData.product.name}, ${price(loaderData.product.price)}. Vice streetwear.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ProductPage,
  notFoundComponent: () => <NotFoundView />,
  errorComponent: () => <NotFoundView title="This piece didn't load" />,
});

function ProductPage() {
  const { product: p } = Route.useLoaderData();
  return <ProductView key={p.id} />;
}

function ProductView() {
  const { product: p } = Route.useLoaderData();
  const [img, setImg] = useState(0);
  const [color, setColor] = useState(p.colors[0]?.name);
  const [size, setSize] = useState(p.sizes.length === 1 ? p.sizes[0] : "");
  const [qty, setQty] = useState(1);
  const [guide, setGuide] = useState(false);
  const [sizeErr, setSizeErr] = useState(false);
  const available = p.inStock && !p.comingSoon;
  const soon = !!p.comingSoon;
  const related = products.filter((x) => x.id !== p.id && (x.category === p.category || x.type === p.type)).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 md:py-16">
      <Link to="/shop" search={{ filter: "all", sort: "newest" }} className="nav-link">← Back to shop</Link>
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div>
          <div className="glass relative aspect-[4/5] overflow-hidden border border-border">
            <img src={p.images[img]} alt={p.name} width={768} height={960} className={`h-full w-full object-cover ${soon ? "scale-110 blur-[10px]" : ""}`} />
            {!available && <span className="absolute right-3 top-3 bg-primary px-2 py-1 text-[10px] font-semibold uppercase tracking-[.2em] text-primary-foreground">{soon ? "Soon" : "Sold out"}</span>}
            {onSale(p) && <span className="absolute left-3 top-3 bg-destructive px-2 py-1 text-[10px] font-bold uppercase tracking-[.2em] text-destructive-foreground">Sale</span>}
          </div>
          <div className="mt-3 flex gap-3">
            {p.images.map((src, i) => (
              <button key={i} onClick={() => setImg(i)} aria-label={`Image ${i + 1}`} className={`h-20 w-16 overflow-hidden border ${i === img ? "border-primary" : "border-border"}`}>
                <img src={src} alt="" className={`h-full w-full object-cover ${soon ? "scale-110 blur-[4px]" : ""}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-7">
          <div>
            {p.dropName && <p className="nav-link mb-2 text-primary">{p.dropName}</p>}
            <h1 className="font-display text-3xl font-semibold uppercase tracking-tight md:text-5xl">{p.name}</h1>
            <p className="mt-3 text-xl"><PriceTag p={p} /></p>
            {p.description && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{p.description}</p>}
            {p.details && p.details.length > 0 && (
              <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-border pt-4 text-sm">
                {p.details.map((d, i) => <div key={i} className="contents"><dt className="text-muted-foreground">{d.label}</dt><dd>{d.value}</dd></div>)}
              </dl>
            )}
          </div>

          <div>
            <p className="nav-link mb-3">Color — <span className="text-foreground">{color}</span></p>
            <div className="flex gap-2">
              {p.colors.map((c) => (
                <button key={c.name} title={c.name} aria-label={c.name} onClick={() => setColor(c.name)} className={`h-9 w-9 rounded-full border-2 ${c.name === color ? "border-primary" : "border-border"}`} style={{ background: c.hex }} />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="nav-link">Size</p>
              {p.sizes.length > 1 && <button onClick={() => setGuide(true)} className="nav-link underline underline-offset-4">Size guide</button>}
            </div>
            <div className="flex flex-wrap gap-2">
              {p.sizes.map((s) => (
                <button key={s} onClick={() => setSize(s)} className={`h-11 min-w-12 border px-4 text-xs font-semibold uppercase tracking-wider ${s === size ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}>{s}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="nav-link mb-3">Quantity</p>
            <div className="inline-flex items-center border border-border">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="h-11 w-11" aria-label="Less">−</button>
              <span className="w-10 text-center text-sm">{qty}</span>
              <button onClick={() => setQty(Math.min(10, qty + 1))} className="h-11 w-11" aria-label="More">+</button>
            </div>
          </div>

          {available ? (
            ORDERING_ENABLED ? (
              <div>
                <button type="button" onClick={() => { if (!size) { setSizeErr(true); return; } cart.addProduct(p, { color, size, qty }); }} className="btn btn-primary w-full">Add to cart</button>
                {sizeErr && !size && <p className="mt-2 text-xs text-primary">Choose a size first.</p>}
              </div>
            ) : (
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">Order on Instagram</a>
            )
          ) : !soon ? (
            <button type="button" disabled className="btn btn-ghost w-full opacity-50">Sold out</button>
          ) : (
            <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">Notify me</a>
          )}
          {soon && <p className="mt-2 text-center text-[10px] text-muted-foreground">Follow us on the WhatsApp channel</p>}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="mb-8 font-display text-2xl font-semibold uppercase md:text-4xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">{related.map((x) => <ProductCard key={x.id} p={x} />)}</div>
        </section>
      )}

      {guide && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-5 backdrop-blur-sm" onClick={() => setGuide(false)}>
          <div role="dialog" aria-label="Size guide" className="glass w-full max-w-md border border-border p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold uppercase">Size guide</h3>
              <button onClick={() => setGuide(false)} aria-label="Close" className="icon-btn">✕</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-2">Size</th><th>Chest width (cm)</th><th>Length (cm)</th></tr></thead>
              <tbody>{SIZE_CHART.map((r) => <tr key={r[0]} className="border-t border-border"><td className="py-2 font-semibold">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
            </table>
            <p className="mt-4 text-xs text-muted-foreground">Measurements are approximate. Between sizes? Size up for a looser fit.</p>
          </div>
        </div>
      )}
    </div>
  );
}
