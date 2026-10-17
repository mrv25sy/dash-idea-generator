import { createFileRoute } from "@tanstack/react-router";
import { useCatalogVersion } from "@/data/products";
import { Hero } from "@/components/site/Hero";
import { DropsSection, SinglesSection, BundlesSection, CommunitySection, CustomSections, CrewBanner } from "@/components/site/Sections";

const title = "Vice — Street calls, we answer";
const description = "Vice is a Syrian streetwear brand. Drops, singles and bundles, shipping to all Syrian governorates.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const v = useCatalogVersion();
  return (
    <div key={v} className="contents">
      <Hero />
      <CrewBanner placement="after-hero" />
      <DropsSection />
      <CrewBanner placement="after-drops" />
      <SinglesSection />
      <CrewBanner placement="after-singles" />
      <CustomSections />
      <CrewBanner placement="after-sections" />
      <BundlesSection />
      <CrewBanner placement="after-bundles" />
      <CommunitySection />
      <CrewBanner placement="after-community" />
    </div>
  );
}
