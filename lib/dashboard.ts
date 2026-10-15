import type { AdPlatform, LibraryAnalysisStatus } from "@/lib/supabase/types";
import { PLATFORMS } from "@/lib/validation/constants";

export type DashboardRow = { platform: AdPlatform; target_country: string; analysis_status: LibraryAnalysisStatus };

export type DashboardSummary = {
  total: number;
  analysed: number;
  awaiting: number;
  failed: number;
  byPlatform: { key: AdPlatform; count: number }[];
  byCountry: { key: string; count: number }[];
};

/** Aggregates library rows into headline research metrics. Pure, so it is unit-tested. */
export function summarise(rows: DashboardRow[], topCountries = 6): DashboardSummary {
  const platform = new Map<AdPlatform, number>(PLATFORMS.map((p) => [p, 0]));
  const country = new Map<string, number>();
  let analysed = 0;
  let failed = 0;

  for (const r of rows) {
    platform.set(r.platform, (platform.get(r.platform) ?? 0) + 1);
    country.set(r.target_country, (country.get(r.target_country) ?? 0) + 1);
    if (r.analysis_status === "complete") analysed += 1;
    if (r.analysis_status === "failed") failed += 1;
  }

  const countries = [...country.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shown = countries.slice(0, topCountries).map(([key, count]) => ({ key, count }));
  const rest = countries.slice(topCountries).reduce((n, [, c]) => n + c, 0);
  if (rest) shown.push({ key: "Other", count: rest });

  return {
    total: rows.length,
    analysed,
    // Not yet analysed, or the last attempt failed: both need someone to run it.
    awaiting: rows.length - analysed - rows.filter((r) => r.analysis_status === "pending").length,
    failed,
    // Platforms keep a fixed order so the chart never reshuffles.
    byPlatform: PLATFORMS.map((key) => ({ key, count: platform.get(key) ?? 0 })),
    byCountry: shown,
  };
}
