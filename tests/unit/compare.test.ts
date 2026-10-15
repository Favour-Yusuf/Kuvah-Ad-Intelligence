import { describe, expect, it } from "vitest";
import { buildCompareRows } from "@/lib/compare";
import type { StoredAnalysis } from "@/lib/analysis/schema";
import type { AdAnalysisRow, AdLibraryRow } from "@/lib/supabase/types";

const ad = (id: string, over: Partial<AdLibraryRow> = {}) =>
  ({
    id,
    brand: id,
    platform: "tiktok",
    target_country: "US",
    format: "video",
    headline: "Same headline",
    cta: "Shop now",
    marketing_angle: null,
    ...over,
  }) as AdLibraryRow;

const field = (value: string) => ({ value, supporting_quote: null });
const stored = (hook: string): StoredAnalysis => ({
  schema_version: 1,
  basis: "interpretation",
  fields: {
    opening_hook: field(hook),
    customer_problem_or_desire: field("x"),
    intended_audience: field("Runners"),
    value_proposition: field("x"),
    offer_and_incentives: field("x"),
    call_to_action: field("x"),
    marketing_angle: field("Peer reviews"),
    creative_format_and_structure: field("x"),
  },
  angle_label: "Social proof",
  effectiveness_reasons: [],
  test_ideas: [],
  limitations: [],
  used_image: false,
});
const run = (adId: string, result: StoredAnalysis) => ({ ad_id: adId, result }) as unknown as AdAnalysisRow;

describe("buildCompareRows", () => {
  const ads = [ad("a"), ad("b", { platform: "instagram" })];
  const rows = buildCompareRows(ads, new Map([["a", run("a", stored("Question opener"))]]));
  const row = (key: string) => rows.find((r) => r.key === key)!;

  it("flags observed rows that differ", () => {
    expect(row("platform").differs).toBe(true);
    expect(row("headline").differs).toBe(false);
  });

  it("labels row sources", () => {
    expect(row("cta").source).toBe("observed");
    expect(row("opening_hook").source).toBe("interpretation");
  });

  it("shows null for ads without an analysis", () => {
    expect(row("opening_hook").cells).toEqual([{ text: "Question opener", quote: null, withheld: undefined }, { text: null }]);
    expect(row("opening_hook").differs).toBe(true);
  });

  it("prefixes the AI angle with its label", () => {
    expect(row("marketing_angle").cells[0].text).toBe("Social proof: Peer reviews");
  });

  it("ignores case and whitespace when detecting differences", () => {
    const same = buildCompareRows([ad("a", { cta: "Shop now" }), ad("b", { cta: " shop NOW " })], new Map());
    expect(same.find((r) => r.key === "cta")!.differs).toBe(false);
  });
});
