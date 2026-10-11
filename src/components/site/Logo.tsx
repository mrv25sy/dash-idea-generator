import red from "@/assets/vice-logo-red.png.asset.json";
import white from "@/assets/vice-logo-white.png.asset.json";
import black from "@/assets/vice-logo-black.png.asset.json";
import { cn } from "@/lib/utils";

/** White V on dark backgrounds, black V on light backgrounds; red V on request. */
export function Logo({ variant = "auto", className }: { variant?: "auto" | "red"; className?: string }) {
  if (variant === "red") {
    return (
      <span className={cn("logo-mark", className)} aria-label="Vice" role="img">
        <img src={red.url} alt="" draggable={false} />
      </span>
    );
  }
  return (
    <span className={cn("logo-mark", className)} aria-label="Vice" role="img">
      <img className="logo-light" src={black.url} alt="" draggable={false} />
      <img className="logo-dark" src={white.url} alt="" draggable={false} />
    </span>
  );
}
