import "server-only";
import { AnalyzerError, inputHash, type AdAnalyzer, type AnalysisInput } from "./analyzer";
import { applyGuardrails } from "./guardrails";
import type { AdLibraryRow, AdAnalysisRow, Json } from "@/lib/supabase/types";
import type { Db } from "@/lib/data/client";
import { finishAnalysis, startAnalysis } from "@/lib/data/analyses";
import { downloadImageCreative } from "@/lib/data/creatives";

export const ANALYSIS_TIMEOUT_MS = 90_000;

/** Per-member limit on analysis runs, counted from ad_analyses. */
export const RATE_LIMIT = { runs: 5, windowMs: 60_000 };

export function toAnalysisInput(ad: AdLibraryRow, image: AnalysisInput["image"]): AnalysisInput {
  return {
    brand: ad.brand,
    platform: ad.platform,
    target_country: ad.target_country,
    format: ad.format,
    headline: ad.headline,
    ad_copy: ad.ad_copy,
    creative_description: ad.creative_description,
    cta: ad.cta,
    image,
  };
}

/**
 * Runs one analysis end to end: records a pending run as the user, calls the
 * analyzer with a deadline, applies guardrails, and stores the outcome with
 * the admin client. Always leaves the run complete or failed.
 */
export async function runAnalysis(deps: { db: Db; admin: Db; analyzer: AdAnalyzer }, ad: AdLibraryRow): Promise<AdAnalysisRow> {
  const image = await downloadImageCreative(deps.db, ad.creative_path);
  const input = toAnalysisInput(ad, image);

  const run = await startAnalysis(deps.db, {
    ad_id: ad.id,
    provider: deps.analyzer.provider,
    model: deps.analyzer.model,
    input_hash: inputHash(input),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new AnalyzerError("timeout", "The analysis took too long. Try again.")), ANALYSIS_TIMEOUT_MS);
  try {
    const raw = await deps.analyzer.analyze(input, controller.signal);
    const { analysis, warnings } = applyGuardrails(raw, input);
    return await finishAnalysis(deps.admin, run.id, { status: "complete", result: analysis as unknown as Json, warnings });
  } catch (error) {
    const message =
      error instanceof AnalyzerError ? error.message : controller.signal.aborted ? "The analysis took too long. Try again." : "The analysis failed. Try again.";
    if (!(error instanceof AnalyzerError)) console.error("Analysis failed", error);
    else if (error.cause) console.warn(`Analysis ${error.kind}`, error.cause);
    return await finishAnalysis(deps.admin, run.id, { status: "failed", error: message });
  } finally {
    clearTimeout(timer);
  }
}
