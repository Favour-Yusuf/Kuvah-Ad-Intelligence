import { describe, expect, it } from "vitest";
import { AnalyzerError, inputHash, type AnalysisInput } from "@/lib/analysis/analyzer";
import { WITHHELD_NOTICE, applyGuardrails, claimsPerformance, longestSharedRun, normalise } from "@/lib/analysis/guardrails";
import { buildUserText } from "@/lib/analysis/prompt";
import { createFakeAnalyzer } from "@/lib/analysis/providers/fake";
import type { ModelOutput } from "@/lib/analysis/schema";

const input: AnalysisInput = {
  brand: "Lumen Skin",
  platform: "instagram",
  target_country: "US",
  format: "video",
  headline: "Your 3-step routine, simplified",
  ad_copy: "Stop guessing which serum goes first. Lumen’s kit tells you exactly what to use. Free shipping over $40.",
  creative_description: "Cluttered shelf, then three labelled bottles.",
  cta: "Shop now",
  image: null,
};

const f = (value: string, supporting_quote: string | null = null) => ({ value, supporting_quote });

function output(overrides: Partial<ModelOutput> = {}): ModelOutput {
  return {
    opening_hook: f("Calls out decision fatigue.", "Stop guessing which serum goes first."),
    customer_problem_or_desire: f("Confusion about routine order."),
    intended_audience: f("Skincare beginners in the US."),
    value_proposition: f("A guided kit removes guesswork."),
    offer_and_incentives: f("Free shipping over $40.", "Free shipping over $40"),
    call_to_action: f("Shop now.", "Shop now"),
    marketing_angle: { label: "Simplicity", value: "Effortless routine.", supporting_quote: null },
    creative_format_and_structure: f("Problem/solution visual."),
    possible_effectiveness_reasons: [{ reason: "Names a common frustration.", supporting_quote: null }],
    test_ideas: [{ idea: "Open with the moment of confusion for a Kuvah product.", rationale: "Tests problem-first framing." }],
    limitations: ["No performance data was supplied."],
    ...overrides,
  };
}

describe("applyGuardrails", () => {
  it("passes a clean analysis through, keeping verified quotes", () => {
    const { analysis, warnings } = applyGuardrails(output(), input);
    expect(warnings).toEqual([]);
    expect(analysis.basis).toBe("interpretation");
    expect(analysis.fields.opening_hook.supporting_quote).toBe("Stop guessing which serum goes first.");
    expect(analysis.fields.offer_and_incentives.value).toBe("Free shipping over $40.");
    expect(analysis.angle_label).toBe("Simplicity");
  });

  it("matches quotes despite curly apostrophes and spacing", () => {
    const { analysis } = applyGuardrails(output({ value_proposition: f("x", "Lumen's  kit tells you") }), input);
    expect(analysis.fields.value_proposition.supporting_quote).toBe("Lumen's  kit tells you");
  });

  it("drops quotes that are not in the captured ad", () => {
    const { analysis, warnings } = applyGuardrails(output({ intended_audience: f("Busy parents.", "Made for busy parents") }), input);
    expect(analysis.fields.intended_audience.supporting_quote).toBeNull();
    expect(warnings).toContain("Removed quotes that do not appear in the captured ad.");
  });

  it.each([
    "This ad likely spends around $5,000 per day.",
    "It probably has a ROAS above 3.",
    "The brand has made $2M in revenue from it.",
    "Conversion rates of 4% suggest it works.",
    "It has reached 1.2 million impressions.",
  ])("withholds a performance claim: %s", (claim) => {
    const { analysis, warnings } = applyGuardrails(output({ value_proposition: f(claim) }), input);
    expect(analysis.fields.value_proposition).toEqual({ value: WITHHELD_NOTICE, supporting_quote: null, withheld: true });
    expect(warnings).toContain("Removed statements about performance data.");
  });

  it("does not treat the ad's own prices as performance claims", () => {
    const { analysis } = applyGuardrails(output({ offer_and_incentives: f("Free shipping on orders over $40 lowers the barrier.") }), input);
    expect(analysis.fields.offer_and_incentives.withheld).toBeUndefined();
  });

  it("drops effectiveness reasons that claim performance", () => {
    const { analysis } = applyGuardrails(
      output({ possible_effectiveness_reasons: [{ reason: "It converts at 5%.", supporting_quote: null }, { reason: "Clear benefit.", supporting_quote: null }] }),
      input,
    );
    expect(analysis.effectiveness_reasons.map((r) => r.reason)).toEqual(["Clear benefit."]);
  });

  it("removes test ideas that copy the original wording", () => {
    const copied = { idea: "Run: Stop guessing which serum goes first. Lumen's kit tells you exactly", rationale: "Proven copy." };
    const { analysis, warnings } = applyGuardrails(output({ test_ideas: [copied, output().test_ideas[0]] }), input);
    expect(analysis.test_ideas).toHaveLength(1);
    expect(warnings).toContain("Removed test ideas that reused the original ad's wording.");
  });

  it("drops the angle label when the angle claims performance", () => {
    const { analysis } = applyGuardrails(
      output({ marketing_angle: { label: "Scaling winner", value: "Spending $10k a day.", supporting_quote: null } }),
      input,
    );
    expect(analysis.angle_label).toBeNull();
  });

  it("rejects output that does not match the schema", () => {
    expect(() => applyGuardrails({ opening_hook: "text" }, input)).toThrow(AnalyzerError);
  });

  it("caps list lengths", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ reason: `Reason ${i}`, supporting_quote: null }));
    expect(applyGuardrails(output({ possible_effectiveness_reasons: many }), input).analysis.effectiveness_reasons).toHaveLength(6);
  });
});

describe("helpers", () => {
  it("normalises punctuation and whitespace", () => {
    expect(normalise("  “Hi”  –  it’s\nhere… ")).toBe('"hi" - it\'s here...');
  });

  it("measures shared word runs", () => {
    expect(longestSharedRun("try the three step kit today", "the three step kit is here")).toBe(4);
    expect(longestSharedRun("nothing shared", "completely different")).toBe(0);
  });

  it("ignores performance words without numbers unless they are metric acronyms", () => {
    expect(claimsPerformance("Highlights sales events.", "")).toBe(false);
    expect(claimsPerformance("Mentions CTR.", "")).toBe(true);
  });

  it("hashes input deterministically and sensitively", () => {
    expect(inputHash(input)).toBe(inputHash({ ...input }));
    expect(inputHash(input)).not.toBe(inputHash({ ...input, cta: "Buy" }));
    expect(inputHash(input)).toHaveLength(64);
  });
});

describe("prompt", () => {
  it("wraps captured content in a delimiter and marks missing fields", () => {
    const text = buildUserText({ ...input, headline: null });
    expect(text).toContain("<captured_ad>");
    expect(text).toContain("Headline: (not captured)");
    expect(text).toContain("Target country: United States (US)");
  });
});

describe("fake analyzer", () => {
  it("produces output that passes guardrails", async () => {
    const raw = await createFakeAnalyzer().analyze(input, new AbortController().signal);
    const { analysis, warnings } = applyGuardrails(raw, input);
    expect(warnings).toEqual([]);
    expect(analysis.fields.opening_hook.supporting_quote).toBe("Your 3-step routine, simplified");
  });
});
