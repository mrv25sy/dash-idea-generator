import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { products, useCatalogVersion, type Product } from "@/data/products";
import { ProductCard } from "@/components/site/Sections";

const FILTERS: { id: string; label: string; test: (p: Product) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "drops", label: "Drops", test: (p) => p.type === "drop" },
  { id: "singles", label: "Singles", test: (p) => p.type === "single" },
  { id: "hoodies", label: "Hoodies", test: (p) => p.type === "single" && p.category === "hoodie" },
  { id: "tees", label: "Tees", test: (p) => p.type === "single" && p.category === "tee" },
  { id: "caps", label: "Caps", test: (p) => p.type === "single" && p.category === "cap" },
];
const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
];

const schema = z.object({
  filter: fallback(z.string(), "all").default("all"),
  sort: fallback(z.string(), "newest").default("newest"),
});

const title = "Shop — Vice";
const description = "Shop every Vice piece: drops, singles, hoodies, tees and caps.";

export const Route = createFileRoute("/shop")({
  validateSearch: zodValidator(schema),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { filter, sort } = Route.useSearch();
  useCatalogVersion();
  const navigate = Route.useNavigate();
  const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0]!;
  const items = products
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => active.test(p))
    .sort((a, b) => (sort === "price-asc" ? a.p.price - b.p.price : sort === "price-desc" ? b.p.price - a.p.price : b.i - a.i))
    .map(({ p }) => p);

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 md:py-24">
      <p className="nav-link mb-2 text-primary">Shop</p>
      <h1 className="font-display text-4xl font-semibold uppercase tracking-tight md:text-6xl">{active.id === "all" ? "Everything" : active.label}</h1>
      <div className="mt-8 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              to="/shop"
              search={(prev) => ({ ...prev, filter: f.id })}
              className={`border px-4 py-2 text-[11px] font-semibold uppercase tracking-[.2em] transition-colors ${f.id === active.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <label className="flex items-center gap-3 text-xs text-muted-foreground">
          Sort
          <select
            value={sort}
            onChange={(e) => navigate({ search: (prev) => ({ ...prev, sort: e.target.value }) })}
            className="border border-border bg-background px-3 py-2 text-xs uppercase tracking-wider text-foreground"
          >
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{items.length} {items.length === 1 ? "piece" : "pieces"}</p>
      {items.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      ) : (
        <p className="py-16 text-sm text-muted-foreground">Nothing here right now.</p>
      )}
    </section>
  );
}
