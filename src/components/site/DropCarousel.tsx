import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { drops } from "@/data/products";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";

export function DropCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!api) return;
    const update = () => setSelected(api.selectedScrollSnap());
    update();
    api.on("select", update);
    api.on("reInit", update);
    return () => { api.off("select", update); api.off("reInit", update); };
  }, [api]);

  return (
    <Carousel aria-label="Current drops" opts={{ align: "center", containScroll: false, loop: drops.length > 1 }} setApi={setApi} className="drop-carousel">
      <CarouselContent className="ml-0 items-center py-5">
        {drops.map((drop, i) => (
          <CarouselItem key={drop.name} aria-label={`${drop.name}, ${i + 1} of ${drops.length}`} className="drop-slide pl-0">
            <article className={`drop-cover ${selected === i ? "is-active" : ""}`}>
              <Link to="/drop/$name" params={{ name: drop.name }} className="block aspect-[4/5] overflow-hidden rounded-lg" draggable={false}>
                <img src={drop.cover} alt={drop.name} loading="lazy" width={768} height={960} draggable={false} className="h-full w-full object-cover" />
              </Link>
              <div className="px-3 pb-3 pt-4">
                <h3 className="break-words font-display text-xl font-semibold uppercase">{drop.name}</h3>
                <p className="mt-2 min-h-10 text-xs text-muted-foreground">{drop.tagline}</p>
                <Link to="/drop/$name" params={{ name: drop.name }} className="btn btn-primary mt-3 h-10 w-full px-2 tracking-[.14em]">View drop</Link>
              </div>
            </article>
          </CarouselItem>
        ))}
      </CarouselContent>
      {drops.length > 1 && <>
        <CarouselPrevious aria-label="Previous drop" title="Previous drop" className="drop-arrow left-2 hidden lg:inline-flex" />
        <CarouselNext aria-label="Next drop" title="Next drop" className="drop-arrow right-2 hidden lg:inline-flex" />
      </>}
    </Carousel>
  );
}