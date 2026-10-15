import red from "@/assets/vice-logo-red-fixed.png.asset.json";
import white from "@/assets/vice-logo-white-fixed.png.asset.json";
import black from "@/assets/vice-logo-black-fixed.png.asset.json";
import { redLogoFallback, whiteLogoFallback, blackLogoFallback } from "@/assets/vice-logo-fallbacks";
import { cn } from "@/lib/utils";
import type { SyntheticEvent } from "react";

function usePortableLogo(event: SyntheticEvent<HTMLImageElement>, fallback: string) {
  const image = event.currentTarget;
  if (image.src !== fallback) image.src = fallback;
}

/** White V on dark backgrounds, black V on light backgrounds; red V on request. */
export function Logo({ variant = "auto", className }: { variant?: "auto" | "red"; className?: string }) {
  if (variant === "red") {
    return (
      <span className={cn("logo-mark", className)} aria-label="Vice" role="img">
        <img src={red.url.startsWith("https://") ? red.url : redLogoFallback} onError={(event) => usePortableLogo(event, redLogoFallback)} alt="" draggable={false} />
      </span>
    );
  }
  return (
    <span className={cn("logo-mark", className)} aria-label="Vice" role="img">
      <img className="logo-light" src={black.url.startsWith("https://") ? black.url : blackLogoFallback} onError={(event) => usePortableLogo(event, blackLogoFallback)} alt="" draggable={false} />
      <img className="logo-dark" src={white.url.startsWith("https://") ? white.url : whiteLogoFallback} onError={(event) => usePortableLogo(event, whiteLogoFallback)} alt="" draggable={false} />
    </span>
  );
}
