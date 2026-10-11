import { Link } from "@tanstack/react-router";
import { DROP_ACTIVE } from "@/config";
import { activeDrop } from "@/data/products";
import { Logo } from "./Logo";

export function Hero() {
  return (
    <section id="top" className="relative flex min-h-[calc(100svh-6rem)] flex-col items-center justify-center overflow-hidden px-5 text-center">
      <div aria-hidden className="hero-glow" />
      <Logo variant="red" className="relative h-14 w-14 md:h-20 md:w-20" />
      <h1 className="relative mt-7 font-display text-3xl font-semibold uppercase leading-[1.05] tracking-tight md:text-4xl lg:text-5xl">
        Street calls,<br />we answer
      </h1>
      <div className="relative mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <a href="#singles" className="btn btn-primary">Shop Singles</a>
        {DROP_ACTIVE && activeDrop && <Link to="/drop/$name" params={{ name: activeDrop.name }} className="btn btn-ghost">View Drop</Link>}
      </div>
    </section>
  );
}
