import { describe, expect, it } from "vitest";
import { adInputSchema, adUpdateSchema, fieldErrors, utcDate } from "@/lib/validation/ad";
import { EMPTY_FILTERS, activeFilterCount, filtersToSearchParams, parseLibraryFilters } from "@/lib/validation/filters";
import { adTagsSchema, collectionItemsAddSchema, noteInputSchema, parseCompareIds } from "@/lib/validation/organise";
import { cleanText } from "@/lib/validation/text";
import { manualSource } from "@/lib/sources/manual";

const validAd = {
  source_url: "https://www.facebook.com/ads/library/?id=123",
  brand: "  Lumen Skin ",
  platform: "instagram",
  target_country: "us",
  industry: "",
  format: "video",
  headline: "Your routine, simplified",
  ad_copy: "Stop guessing.\r\nFree shipping over $40.",
  creative_description: "",
  cta: "Shop now",
  observed_at: "2026-10-10",
  research_notes: null,
};

describe("adInputSchema", () => {
  it("cleans and normalises a valid capture", () => {
    const ad = adInputSchema.parse(validAd);
    expect(ad.brand).toBe("Lumen Skin");
    expect(ad.target_country).toBe("US");
    expect(ad.industry).toBeNull();
    expect(ad.creative_description).toBeNull();
    expect(ad.ad_copy).toBe("Stop guessing.\nFree shipping over $40.");
    expect(ad.creative_path).toBeNull();
  });

  it.each([
    ["http://example.com/ad", "https"],
    ["javascript:alert(1)", "https"],
    ["not a url", "https"],
  ])("rejects source URL %s", (source_url, message) => {
    const result = adInputSchema.safeParse({ ...validAd, source_url });
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!).source_url).toMatch(message);
  });

  it("rejects a future observed date", () => {
    const result = adInputSchema.safeParse({ ...validAd, observed_at: utcDate(5) });
    expect(fieldErrors(result.error!).observed_at).toMatch(/future/);
  });

  it("accepts today, allowing timezone slack", () => {
    expect(adInputSchema.safeParse({ ...validAd, observed_at: utcDate(0) }).success).toBe(true);
    expect(adInputSchema.safeParse({ ...validAd, observed_at: utcDate(1) }).success).toBe(true);
  });

  it("rejects impossible dates", () => {
    expect(adInputSchema.safeParse({ ...validAd, observed_at: "2026-13-40" }).success).toBe(false);
  });

  it("requires something to research", () => {
    const result = adInputSchema.safeParse({ ...validAd, headline: "", ad_copy: " ", creative_description: null });
    expect(fieldErrors(result.error!).ad_copy).toMatch(/headline, ad copy or a creative description/);
  });

  it("rejects unknown platforms and enforces length limits", () => {
    expect(adInputSchema.safeParse({ ...validAd, platform: "myspace" }).success).toBe(false);
    const long = adInputSchema.safeParse({ ...validAd, cta: "x".repeat(81) });
    expect(fieldErrors(long.error!).cta).toMatch(/80 characters/);
  });

  it("only accepts creative paths the upload route generates", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(adInputSchema.safeParse({ ...validAd, creative_path: `ads/${id}/${id}.png` }).success).toBe(true);
    expect(adInputSchema.safeParse({ ...validAd, creative_path: "../secrets.png" }).success).toBe(false);
  });

  it("strips fields the client must not set", () => {
    const ad = adInputSchema.parse({ ...validAd, created_by: "someone", id: "x" });
    expect(ad).not.toHaveProperty("created_by");
    expect(ad).not.toHaveProperty("id");
  });
});

describe("adUpdateSchema", () => {
  it("accepts a partial edit", () => {
    expect(adUpdateSchema.parse({ marketing_angle: " Convenience " })).toEqual({ marketing_angle: "Convenience" });
  });
});

describe("cleanText", () => {
  it("removes control characters but keeps newlines and tabs", () => {
    expect(cleanText(" a\u0000b\tc\u0007\nd ")).toBe("ab\tc\nd");
  });
});

describe("library filters", () => {
  it("parses a full query string", () => {
    const f = parseLibraryFilters({
      q: " serum ",
      platform: "tiktok,Instagram,bogus",
      country: "us,gb,usa",
      format: "video",
      industry: "Beauty",
      status: "complete",
      tag: "hooks",
      sort: "captured",
      page: "3",
    });
    expect(f).toEqual({
      q: "serum",
      platforms: ["tiktok", "instagram"],
      countries: ["US", "GB"],
      formats: ["video"],
      industry: "Beauty",
      angle: null,
      status: "complete",
      tag: "hooks",
      sort: "captured",
      page: 3,
    });
  });

  it("falls back to defaults for junk input", () => {
    expect(parseLibraryFilters({ page: "-2", status: "weird", sort: "random" })).toEqual(EMPTY_FILTERS);
  });

  it("round-trips through search params", () => {
    const f = parseLibraryFilters({ q: "hook", platform: "google", country: "GB", page: "2" });
    const again = parseLibraryFilters(Object.fromEntries(filtersToSearchParams(f)));
    expect(again).toEqual(f);
  });

  it("omits defaults from URLs", () => {
    expect(filtersToSearchParams(EMPTY_FILTERS).toString()).toBe("");
  });

  it("counts active filters", () => {
    expect(activeFilterCount(parseLibraryFilters({ q: "x", platform: "tiktok,google", status: "none" }))).toBe(4);
  });
});

describe("organising schemas", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("deduplicates tags case-insensitively", () => {
    expect(adTagsSchema.parse({ tags: ["Hooks", " hooks ", "UGC"] })).toEqual({ tags: ["Hooks", "UGC"] });
  });

  it("rejects empty notes", () => {
    expect(noteInputSchema.safeParse({ body: "   " }).success).toBe(false);
  });

  it("requires ads when adding to a collection", () => {
    expect(collectionItemsAddSchema.safeParse({ ad_ids: [] }).success).toBe(false);
    expect(collectionItemsAddSchema.parse({ ad_ids: [id] }).note).toBeNull();
  });

  it("accepts 2–4 unique ids for comparison", () => {
    const other = "22222222-2222-4222-8222-222222222222";
    expect(parseCompareIds(`${id},${other}`).success).toBe(true);
    expect(parseCompareIds(`${id},${id}`).success).toBe(false);
    expect(parseCompareIds("x,y").success).toBe(false);
  });
});

describe("manual source adapter", () => {
  it("produces a draft from valid input", () => {
    const result = manualSource.toAdDraft(validAd);
    expect(result.ok).toBe(true);
  });

  it("returns field errors for invalid input", () => {
    const result = manualSource.toAdDraft({ ...validAd, brand: "" });
    expect(result).toEqual({ ok: false, errors: expect.objectContaining({ brand: "Brand is required." }) });
  });
});
