import { createFileRoute, Link } from "@tanstack/react-router";
import { dropClosed, drops, products, useCatalogVersion } from "@/data/products";
import { ProductCard } from "@/components/site/Sections";

export const Route = createFileRoute("/drop/$name")({
  head: ({ params }) => {
    const t = `${decodeURIComponent(params.name)} Drop — Vice`;
    const d = `Shop every piece from the Vice ${decodeURIComponent(params.name)} drop.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: DropPage,
});

function DropPage() {
  useCatalogVersion();
  const name = decodeURIComponent(Route.useParams().name);
  const info = drops.find((d) => d.name.toLowerCase() === name.toLowerCase());
  const items = products.filter((p) => p.type === "drop" && (p.dropName ?? "").toLowerCase() === name.toLowerCase());
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 md:py-24">
      <Link to="/" className="nav-link hover:text-foreground">← Back</Link>
      <p className="nav-link mb-2 mt-6 text-primary">Drop</p>
      <h1 className="font-display text-4xl font-semibold uppercase tracking-tight md:text-6xl">{info?.name ?? name}</h1>
      {info?.tagline && <p className="mt-2 text-sm text-muted-foreground">{info.tagline}</p>}
      <p className="mt-6 text-xs text-muted-foreground">{items.length} {items.length === 1 ? "piece" : "pieces"}</p>
      {info && dropClosed(info) && <p className="mt-4 inline-block bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-[.2em] text-primary-foreground">This drop is closed</p>}
      {items.length > 0 ? (
        <div className={`mt-6 ${info && dropClosed(info) ? "pointer-events-none select-none blur-sm" : ""}`}><div className=" grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div></div>
      ) : (
        <p className="py-16 text-sm text-muted-foreground">Nothing in this drop yet.</p>
      )}
    </section>
  );
}
