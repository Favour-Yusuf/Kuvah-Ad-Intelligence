import { readStoredAnalysis, type InterpretedKey } from "@/lib/analysis/schema";
import type { AdAnalysisRow, AdLibraryRow } from "@/lib/supabase/types";
import { FORMAT_LABELS, PLATFORM_LABELS, countryName } from "@/lib/validation/constants";

export type CompareCell = { text: string | null; quote?: string | null; withheld?: boolean };
export type CompareRow = {
  key: string;
  label: string;
  source: "observed" | "interpretation";
  cells: CompareCell[];
  differs: boolean;
};

const OBSERVED: { key: string; label: string; get: (ad: AdLibraryRow) => string | null }[] = [
  { key: "platform", label: "Platform", get: (a) => PLATFORM_LABELS[a.platform] },
  { key: "country", label: "Target country", get: (a) => countryName(a.target_country) },
  { key: "format", label: "Format", get: (a) => FORMAT_LABELS[a.format] },
  { key: "headline", label: "Headline", get: (a) => a.headline },
  { key: "cta", label: "Call to action", get: (a) => a.cta },
  { key: "angle", label: "Marketing angle (set by the team)", get: (a) => a.marketing_angle },
];

const INTERPRETED: { key: InterpretedKey; label: string }[] = [
  { key: "opening_hook", label: "Hook" },
  { key: "offer_and_incentives", label: "Offer" },
  { key: "marketing_angle", label: "Angle (AI)" },
  { key: "intended_audience", label: "Audience" },
  { key: "value_proposition", label: "Value proposition" },
  { key: "creative_format_and_structure", label: "Creative structure" },
];

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

function differs(cells: CompareCell[]) {
  return new Set(cells.map((c) => norm(c.text))).size > 1;
}

/**
 * Builds side-by-side rows. Observed rows come from what the team captured;
 * interpretation rows from each ad's latest complete analysis, or null when
 * there is none.
 */
export function buildCompareRows(ads: AdLibraryRow[], analyses: Map<string, AdAnalysisRow>): CompareRow[] {
  const stored = ads.map((ad) => readStoredAnalysis(analyses.get(ad.id)?.result));

  const observed: CompareRow[] = OBSERVED.map(({ key, label, get }) => {
    const cells = ads.map((ad) => ({ text: get(ad) }));
    return { key, label, source: "observed", cells, differs: differs(cells) };
  });

  const interpreted: CompareRow[] = INTERPRETED.map(({ key, label }) => {
    const cells = stored.map((s) => {
      if (!s) return { text: null };
      const f = s.fields[key];
      const text = key === "marketing_angle" && s.angle_label ? `${s.angle_label}: ${f.value}` : f.value;
      return { text, quote: f.supporting_quote, withheld: f.withheld };
    });
    return { key, label, source: "interpretation", cells, differs: differs(cells) };
  });

  return [...observed, ...interpreted];
}
