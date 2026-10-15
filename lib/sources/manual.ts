import { adInputSchema, fieldErrors } from "@/lib/validation/ad";
import type { AdSourceAdapter } from "./adapter";

/** A team member typed the details in from an ad they saw. */
export const manualSource: AdSourceAdapter<unknown> = {
  id: "manual",
  label: "Manual capture",
  toAdDraft(input) {
    const parsed = adInputSchema.safeParse(input);
    return parsed.success ? { ok: true, draft: parsed.data } : { ok: false, errors: fieldErrors(parsed.error) };
  },
};

const SOURCES: Record<string, AdSourceAdapter> = { [manualSource.id]: manualSource };

export function getSource(id: string): AdSourceAdapter | undefined {
  return SOURCES[id];
}
