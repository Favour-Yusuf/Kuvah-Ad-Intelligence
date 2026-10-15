import type { AdAnalyzer, AnalysisInput } from "../analyzer";
import type { ModelOutput } from "../schema";

function firstSentence(text: string | null) {
  if (!text) return null;
  const s = text.split(/(?<=[.!?])\s+|\n/)[0]?.trim();
  return s ? s.slice(0, 120) : null;
}

/**
 * Deterministic, offline analyzer for tests and local development
 * (ANALYSIS_PROVIDER=fake). Output depends only on the input text.
 */
export function createFakeAnalyzer(overrides?: (input: AnalysisInput) => unknown): AdAnalyzer {
  return {
    provider: "fake",
    model: "fake-analyzer-v1",
    async analyze(input, signal) {
      if (signal.aborted) throw signal.reason;
      if (overrides) return overrides(input);

      const hook = firstSentence(input.headline) ?? firstSentence(input.ad_copy);
      const quote = (q: string | null) => q;
      const output: ModelOutput = {
        opening_hook: { value: hook ? `Opens with: ${hook}` : "Not shown in the captured content.", supporting_quote: quote(hook) },
        customer_problem_or_desire: { value: "Inferred from the copy: a wish for a simpler, more reliable option.", supporting_quote: null },
        intended_audience: { value: `Shoppers in ${input.target_country} interested in ${input.brand}'s category.`, supporting_quote: null },
        value_proposition: { value: "Positions the product as an easy upgrade.", supporting_quote: null },
        offer_and_incentives: { value: "No explicit offer identified by the offline analyzer.", supporting_quote: null },
        call_to_action: { value: input.cta ? `Asks the viewer to "${input.cta}".` : "No call to action captured.", supporting_quote: input.cta },
        marketing_angle: { label: "Simplicity", value: "Frames the product as removing effort.", supporting_quote: null },
        creative_format_and_structure: { value: `A ${input.format} ad on ${input.platform}.`, supporting_quote: null },
        possible_effectiveness_reasons: [{ reason: "A direct opening may stop the scroll.", supporting_quote: quote(hook) }],
        test_ideas: [{ idea: "Test a problem-first opening for a Kuvah product.", rationale: "Checks whether naming the pain point lifts attention." }],
        limitations: ["Offline analyzer: placeholder interpretation for development."],
      };
      return output;
    },
  };
}
