import type { AdInput } from "@/lib/validation/ad";

/**
 * A source of ad records. v1 ships only the manual adapter.
 *
 * Rules for future adapters:
 * - Use only documented, authorised APIs or data feeds the team has access to.
 * - Never scrape pages, call undocumented endpoints or bypass access controls.
 * - Return drafts; a person still reviews before anything is saved or analysed.
 */
export interface AdSourceAdapter<Input = unknown> {
  /** Stored in ads.source_type. Lowercase, letters, digits and underscores. */
  readonly id: string;
  readonly label: string;
  /** Validates source-specific input and maps it to a capture draft. */
  toAdDraft(input: Input): AdSourceResult;
}

export type AdSourceResult =
  | { ok: true; draft: AdInput }
  | { ok: false; errors: Record<string, string> };
