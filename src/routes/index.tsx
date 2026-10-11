import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dash — Your project starts here" },
      { name: "description", content: "Dash is a fresh project, ready to be built out." },
      { property: "og:title", content: "Dash — Your project starts here" },
      { property: "og:description", content: "Dash is a fresh project, ready to be built out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <h1 className="text-7xl font-bold tracking-tight text-foreground">Dash</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        Your new project is ready. Tell me what you want Dash to do and I'll build it.
      </p>
    </main>
  );
}
