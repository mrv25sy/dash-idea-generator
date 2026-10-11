import { Link } from "@tanstack/react-router";

export function NotFoundView({ title = "Lost in the street" }: { title?: string }) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 py-24 text-center">
      <p className="font-display text-8xl font-semibold text-primary md:text-9xl">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold uppercase tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">This page doesn't exist or has moved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn btn-primary">Go home</Link>
        <Link to="/shop" search={{ filter: "all", sort: "newest" }} className="btn btn-ghost">Shop</Link>
      </div>
    </section>
  );
}
