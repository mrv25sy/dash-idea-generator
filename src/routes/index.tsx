import { createFileRoute } from "@tanstack/react-router";

import { Timer } from "@/components/timer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dash — Timer" },
      {
        name: "description",
        content:
          "Dash is a clean countdown timer: pick a preset, type any time, and let the ring run down.",
      },
      { property: "og:title", content: "Dash — Timer" },
      {
        property: "og:description",
        content: "A clean countdown timer with presets, custom times, and a chime when it's up.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-[calc(100svh-4.5rem)] items-center justify-center bg-background px-6 py-10">
      <Timer />
    </main>
  );
}
