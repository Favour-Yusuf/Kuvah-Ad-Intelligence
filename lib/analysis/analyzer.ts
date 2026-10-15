import { createHash } from "node:crypto";
import type { AdFormat, AdPlatform } from "@/lib/supabase/types";

/** Everything the model may see. Built only from what a team member captured. */
export type AnalysisInput = {
  brand: string;
  platform: AdPlatform;
  target_country: string;
  format: AdFormat;
  headline: string | null;
  ad_copy: string | null;
  creative_description: string | null;
  cta: string | null;
  /** Only images the team uploaded with permission; never fetched from the source URL. */
  image: { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string } | null;
};

export type AnalyzerErrorKind = "refused" | "invalid_output" | "unavailable" | "timeout" | "truncated";

export class AnalyzerError extends Error {
  constructor(
    readonly kind: AnalyzerErrorKind,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AnalyzerError";
  }
}

/** A replaceable analysis provider. Implementations return unvalidated output; guardrails validate it. */
export interface AdAnalyzer {
  readonly provider: string;
  readonly model: string;
  analyze(input: AnalysisInput, signal: AbortSignal): Promise<unknown>;
}

/** Stable fingerprint of the input, so repeated runs on unchanged content are recognisable. */
export function inputHash(input: AnalysisInput) {
  const { image, ...text } = input;
  const imageHash = image ? createHash("sha256").update(image.base64).digest("hex") : null;
  const keys = Object.keys(text).sort() as (keyof typeof text)[];
  const canonical = JSON.stringify([keys.map((k) => [k, text[k]]), imageHash]);
  return createHash("sha256").update(canonical).digest("hex");
}

/** All text the model was given, for verifying quotes and detecting copying. */
export function inputText(input: AnalysisInput) {
  return [input.headline, input.ad_copy, input.creative_description, input.cta].filter(Boolean).join("\n");
}
