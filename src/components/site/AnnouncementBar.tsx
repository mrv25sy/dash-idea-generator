import { DROP_ACTIVE } from "@/config";

export function AnnouncementBar() {
  const items = ["Street calls, we answer", "Shipping to all Syrian governorates"];
  if (DROP_ACTIVE) items.push("New drop is live");
  const row = [...items, ...items, ...items, ...items];
  return (
    <div className="relative z-50 overflow-hidden border-b border-border bg-background/60 py-2">
      <div className="marquee flex w-max" role="marquee" aria-label={items.join(". ")}>
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 gap-10 pr-10" aria-hidden="true">
            {row.map((t, i) => (
              <span key={i} className="flex items-center gap-10 text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
                {t}
                <span className="text-primary">●</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
