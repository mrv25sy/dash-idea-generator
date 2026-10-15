import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowRight } from "lucide-react";
import { dropClosed, visibleDrops, type Drop } from "@/data/products";

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return now;
}
function left(d: Drop, now: number) {
  const ms = new Date(d.endsAt!).getTime() - now;
  const s = Math.max(0, Math.floor(ms / 1000));
  const dd = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${dd > 0 ? `${dd}d ` : ""}${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function DropsCarousel() {
  const drops = visibleDrops();
  const now = useNow();
  const [viewportRef, api] = useEmblaCarousel({ loop: true, align: "center", startIndex: drops.length > 1 ? 1 : 0, duration: 35 });
  const [selected, setSelected] = useState(drops.length > 1 ? 1 : 0);
  const onSelect = useCallback(() => { if (api) setSelected(api.selectedScrollSnap()); }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect).on("reInit", onSelect);
    return () => { api.off("select", onSelect).off("reInit", onSelect); };
  }, [api, onSelect]);

  return (
    <div className="drops-carousel" role="region" aria-roledescription="carousel" aria-label="Current drops" onKeyDown={(event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); api?.scrollPrev(); }
      if (event.key === "ArrowRight") { event.preventDefault(); api?.scrollNext(); }
    }}>
      <div className="drops-viewport" ref={viewportRef}>
        <div className="drops-track">
          {drops.map((drop, index) => (
            <div className="drops-slide" key={drop.name} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${drops.length}`}>
              <article className={`drops-card${selected === index ? " is-selected" : ""}${dropClosed(drop, now) ? " is-closed" : ""}`}>
                <Link to="/drop/$name" params={{ name: drop.name }} className="drops-card-link" tabIndex={selected === index ? 0 : -1} onClick={(event) => {
                  if (selected !== index) { event.preventDefault(); api?.scrollTo(index); }
                }} draggable={false}>
                  <img src={drop.cover} alt={drop.name} loading="lazy" width={768} height={960} draggable={false} className="drops-cover" />
                  {drop.endsAt && <span className="drops-timer" suppressHydrationWarning>{dropClosed(drop, now) ? "Closed" : `Closes in ${left(drop, now)}`}</span>}
                  <div className="drops-card-caption">
                    <h3 className="font-display text-xl font-semibold uppercase md:text-3xl">{drop.name}</h3>
                    <p className="mt-2 text-xs md:text-sm">{drop.tagline}</p>
                    <span className="drops-card-cta">View drop <ArrowRight size={16} /></span>
                  </div>
                </Link>
              </article>
            </div>
          ))}
        </div>
      </div>
      <div className="drops-navigation">
        <span className="drops-counter" aria-live="polite" aria-atomic="true">{String(selected + 1).padStart(2, "0")} <span>/ {String(drops.length).padStart(2, "0")}</span></span>
      </div>
    </div>
  );
}