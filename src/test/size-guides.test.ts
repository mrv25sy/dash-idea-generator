import { describe, expect, it } from "vitest";
import { guideFor, type SizeGuide } from "@/lib/size-guides";

const g = (id: string, category: string, productIds: string[] = []): SizeGuide => ({ id, name: id, category, productIds, columns: [], rows: [] });
const guides = [g("fallback", ""), g("hoodie", "hoodie"), g("boxy", "", ["boxy-hoodie"])];

describe("size guides", () => {
  it("design-specific guide beats its category", () => expect(guideFor(guides, "boxy-hoodie", "hoodie")?.id).toBe("boxy"));
  it("category default", () => expect(guideFor(guides, "midnight", "hoodie")?.id).toBe("hoodie"));
  it("falls back to general guide", () => expect(guideFor(guides, "x", "pants")?.id).toBe("fallback"));
  it("no guide when nothing matches", () => expect(guideFor([g("hoodie", "hoodie")], "x", "pants")).toBeNull());
});
