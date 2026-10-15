import { AnalyzerError, inputText, type AnalysisInput } from "./analyzer";
import {
  INTERPRETED_FIELDS,
  modelOutputSchema,
  type InterpretedField,
  type InterpretedKey,
  type StoredAnalysis,
} from "./schema";

const MAX_FIELD = 700;
const MAX_QUOTE = 300;
const MAX_ITEMS = 6;
const COPY_RUN_WORDS = 8;

export const WITHHELD_NOTICE =
  "Withheld: the AI output referred to performance data (such as spend, revenue or conversions), which Kuvah cannot verify.";

/** Lowercase, unify quotes and dashes, collapse whitespace. Used for quote and copy matching. */
export function normalise(text: string) {
  return text
    .toLowerCase()
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

const NUMBER = String.raw`(?:[$£€]\s?\d|\d[\d,.]*\s?(?:%|k\b|m\b|x\b|million|thousand|billion)|\d)`;
const PERFORMANCE_TERMS = String.raw`(?:ad\s?spend|spend(?:s|ing)?|spent|budgets?|revenue|turnover|roas|return on ad spend|cpa|cpc|cpm|ctr|click[- ]through|conversion rates?|conversions?|converts?|units sold|sold|sales (?:of|figures?|volume)|orders|impressions|reach(?:ed)?|views|profit(?:s|able)?|roi)`;
const NEAR = String.raw`[^.!?\n]{0,40}`;

/** Performance claims: a performance term within the same clause as a number, or ROAS/CPA/CTR-style metrics. */
const PERFORMANCE_CLAIM = new RegExp(
  String.raw`\b${PERFORMANCE_TERMS}\b${NEAR}${NUMBER}|${NUMBER}${NEAR}\b${PERFORMANCE_TERMS}\b|\b(?:roas|cpa|cpc|cpm|ctr)\b`,
  "i",
);

/**
 * True when text claims performance data. Numbers that appear verbatim in the
 * captured ad (e.g. "Free shipping over $40") are not claims about performance.
 */
export function claimsPerformance(text: string, source: string) {
  const match = PERFORMANCE_CLAIM.exec(text);
  if (!match) return false;
  const numbers = match[0].match(/[$£€]?\s?\d[\d,.]*\s?%?/g) ?? [];
  const sourceNorm = normalise(source);
  const metric = /\b(?:roas|cpa|cpc|cpm|ctr)\b/i.test(match[0]);
  // A metric acronym is always a claim. Otherwise, a claim only if some number is not from the ad itself.
  return metric || numbers.length === 0 || numbers.some((n) => !sourceNorm.includes(normalise(n)));
}

/** Longest run of consecutive words shared by `text` and `source`. */
export function longestSharedRun(text: string, source: string) {
  const words = (s: string) => normalise(s).replace(/[^\p{L}\p{N}' ]/gu, " ").split(" ").filter(Boolean);
  const a = words(text);
  const b = words(source);
  if (!a.length || !b.length) return 0;
  const sourceGrams = new Set<string>();
  let best = 0;
  // Grow n while any n-gram of `text` exists in `source`.
  for (let n = 1; n <= a.length; n++) {
    sourceGrams.clear();
    for (let i = 0; i + n <= b.length; i++) sourceGrams.add(b.slice(i, i + n).join(" "));
    let found = false;
    for (let i = 0; i + n <= a.length; i++) {
      if (sourceGrams.has(a.slice(i, i + n).join(" "))) {
        found = true;
        break;
      }
    }
    if (!found) break;
    best = n;
  }
  return best;
}

function clip(text: string, max: number) {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Keeps a quote only if it really appears in the captured text. */
function verifyQuote(quote: string | null, source: string): string | null {
  if (!quote) return null;
  const q = normalise(quote.replace(/^["'“‘]+|["'”’]+$/g, ""));
  if (q.length < 3 || q.length > MAX_QUOTE) return null;
  return normalise(source).includes(q) ? clip(quote, MAX_QUOTE) : null;
}

export type GuardrailResult = { analysis: StoredAnalysis; warnings: string[] };

/**
 * Validates raw model output and makes it safe to store and display:
 * schema check, verified quotes, no performance claims, no copied creative.
 */
export function applyGuardrails(raw: unknown, input: AnalysisInput): GuardrailResult {
  const parsed = modelOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AnalyzerError("invalid_output", "The AI returned an analysis in an unexpected format. Try again.", parsed.error);
  }
  const out = parsed.data;
  const source = inputText(input);
  const warnings = new Set<string>();

  const field = (value: string, quote: string | null): InterpretedField => {
    if (claimsPerformance(value, source)) {
      warnings.add("Removed statements about performance data.");
      return { value: WITHHELD_NOTICE, supporting_quote: null, withheld: true };
    }
    const verified = verifyQuote(quote, source);
    if (quote && !verified) warnings.add("Removed quotes that do not appear in the captured ad.");
    return { value: clip(value, MAX_FIELD), supporting_quote: verified };
  };

  const fields = {} as Record<InterpretedKey, InterpretedField>;
  for (const [key] of INTERPRETED_FIELDS) {
    const f = out[key];
    fields[key] = field(f.value, f.supporting_quote);
  }

  const angleLabel = clip(out.marketing_angle.label, 60);
  const angleUsable = Boolean(angleLabel) && !fields.marketing_angle.withheld && !claimsPerformance(angleLabel, source);

  const reasons = out.possible_effectiveness_reasons
    .slice(0, MAX_ITEMS)
    .filter((r) => {
      if (claimsPerformance(r.reason, source)) {
        warnings.add("Removed statements about performance data.");
        return false;
      }
      return r.reason.trim().length > 0;
    })
    .map((r) => ({ reason: clip(r.reason, MAX_FIELD), supporting_quote: verifyQuote(r.supporting_quote, source) }));

  const ideas = out.test_ideas
    .slice(0, MAX_ITEMS)
    .filter((t) => {
      if (longestSharedRun(`${t.idea} ${t.rationale}`, source) > COPY_RUN_WORDS) {
        warnings.add("Removed test ideas that reused the original ad's wording.");
        return false;
      }
      if (claimsPerformance(`${t.idea} ${t.rationale}`, source)) {
        warnings.add("Removed statements about performance data.");
        return false;
      }
      return t.idea.trim().length > 0;
    })
    .map((t) => ({ idea: clip(t.idea, MAX_FIELD), rationale: clip(t.rationale, MAX_FIELD) }));

  return {
    analysis: {
      schema_version: 1,
      basis: "interpretation",
      fields,
      angle_label: angleUsable ? angleLabel : null,
      effectiveness_reasons: reasons,
      test_ideas: ideas,
      limitations: out.limitations.slice(0, MAX_ITEMS).map((l) => clip(l, 300)).filter(Boolean),
      used_image: Boolean(input.image),
    },
    warnings: [...warnings],
  };
}
