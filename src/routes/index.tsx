import { createFileRoute } from "@tanstack/react-router";
import { useCatalogVersion, sectionHidden as h } from "@/data/products";
import { Hero } from "@/components/site/Hero";
import { DropsSection, SinglesSection, BundlesSection, CommunitySection, CustomSections, CrewBanner, InstagramSection } from "@/components/site/Sections";

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
    <div className="contents">
      <Hero />
      <CrewBanner placement="after-hero" />
      {!h("drops") && <DropsSection />}
      <CrewBanner placement="after-drops" />
      {!h("singles") && <SinglesSection />}
      <CrewBanner placement="after-singles" />
      {!h("custom") && <CustomSections />}
      <CrewBanner placement="after-sections" />
      {!h("bundles") && <BundlesSection />}
      <CrewBanner placement="after-bundles" />
      {!h("community") && <CommunitySection />}
      <CrewBanner placement="after-community" />
      {!h("instagram") && <InstagramSection />}
    </div>
  );
}
