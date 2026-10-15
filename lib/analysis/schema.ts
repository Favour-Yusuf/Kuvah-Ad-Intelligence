import { z } from "zod";

/**
 * What the model returns. Kept structurally simple so it converts cleanly to a
 * JSON Schema for structured outputs; length and content rules are enforced
 * afterwards by guardrails.ts.
 *
 * There are deliberately no fields for spend, revenue, ROAS, conversions,
 * reach or any other performance data: the input never contains it.
 */
const interpreted = z.object({
  value: z.string().describe("Your interpretation, in one to three sentences."),
  supporting_quote: z
    .string()
    .nullable()
    .describe("An exact, verbatim excerpt from the supplied ad text that supports this, or null."),
});

export const modelOutputSchema = z.object({
  opening_hook: interpreted,
  customer_problem_or_desire: interpreted,
  intended_audience: interpreted,
  value_proposition: interpreted,
  offer_and_incentives: interpreted,
  call_to_action: interpreted,
  marketing_angle: z.object({
    label: z.string().describe("A short name for the angle, two to four words, e.g. 'Social proof'."),
    value: z.string(),
    supporting_quote: z.string().nullable(),
  }),
  creative_format_and_structure: interpreted,
  possible_effectiveness_reasons: z
    .array(z.object({ reason: z.string(), supporting_quote: z.string().nullable() }))
    .describe("Two to five reasons the messaging could work, framed as hypotheses."),
  test_ideas: z
    .array(z.object({ idea: z.string(), rationale: z.string() }))
    .describe("Two to five original ideas Kuvah could test. Never reuse the ad's wording or creative."),
  limitations: z.array(z.string()).describe("What the supplied content did not allow you to judge."),
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;

export const INTERPRETED_FIELDS = [
  ["opening_hook", "Opening hook"],
  ["customer_problem_or_desire", "Customer problem or desire"],
  ["intended_audience", "Intended audience"],
  ["value_proposition", "Value proposition"],
  ["offer_and_incentives", "Offer and incentives"],
  ["call_to_action", "Call to action"],
  ["marketing_angle", "Marketing angle"],
  ["creative_format_and_structure", "Creative format and structure"],
] as const;

export type InterpretedKey = (typeof INTERPRETED_FIELDS)[number][0];

export type InterpretedField = { value: string; supporting_quote: string | null; withheld?: boolean };

/** What Kuvah stores in ad_analyses.result after guardrails. */
export type StoredAnalysis = {
  schema_version: 1;
  basis: "interpretation";
  fields: Record<InterpretedKey, InterpretedField>;
  angle_label: string | null;
  effectiveness_reasons: { reason: string; supporting_quote: string | null }[];
  test_ideas: { idea: string; rationale: string }[];
  limitations: string[];
  used_image: boolean;
};

/** Validates a stored result read back from the database. */
export function readStoredAnalysis(value: unknown): StoredAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<StoredAnalysis>;
  if (v.schema_version !== 1 || !v.fields || typeof v.fields !== "object") return null;
  return v as StoredAnalysis;
}
