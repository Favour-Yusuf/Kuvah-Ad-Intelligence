import { z } from "zod";
import { FORMATS, PLATFORMS } from "./constants";
import { cleanText, optionalText, requiredText } from "./text";

/** Today's date in UTC as YYYY-MM-DD; `offsetDays` allows timezone slack. */
export function utcDate(offsetDays = 0, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
  return d.toISOString().slice(0, 10);
}

export const sourceUrlSchema = z
  .string({ error: "Source URL is required." })
  .transform(cleanText)
  .pipe(
    z
      .url({ protocol: /^https$/, error: "Enter a full https:// link to where you saw the ad." })
      .max(2048, "Source URL is too long."),
  );

export const observedAtSchema = z
  .string({ error: "Date observed is required." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Enter a real date.")
  .refine((v) => v >= "2000-01-01", "Date observed is too far in the past.")
  // One day of slack so a capture made late in a US evening still validates.
  .refine((v) => v <= utcDate(1), "Date observed cannot be in the future.");

export const countrySchema = z
  .string({ error: "Target country is required." })
  .transform((v) => cleanText(v).toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}$/, "Choose a target country."));

const adFields = {
  source_url: sourceUrlSchema,
  brand: requiredText(120, "Brand"),
  platform: z.enum(PLATFORMS, { error: "Choose a platform." }),
  target_country: countrySchema,
  industry: optionalText(80, "Industry"),
  format: z.enum(FORMATS, { error: "Choose a format." }),
  headline: optionalText(300, "Headline"),
  ad_copy: optionalText(5000, "Ad copy"),
  creative_description: optionalText(3000, "Creative description"),
  cta: optionalText(80, "Call to action"),
  observed_at: observedAtSchema,
  research_notes: optionalText(5000, "Research notes"),
  marketing_angle: optionalText(120, "Marketing angle"),
  creative_path: z
    .string()
    .regex(/^ads\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|mp4)$/, "Invalid creative reference.")
    .nullish()
    .transform((v) => v ?? null),
};

/**
 * Capture input. At least one of headline, ad copy or creative description is
 * needed, otherwise there is nothing to research or analyse.
 */
export const adInputSchema = z
  .object(adFields)
  .strip()
  .refine((ad) => Boolean(ad.headline || ad.ad_copy || ad.creative_description), {
    message: "Add the headline, ad copy or a creative description.",
    path: ["ad_copy"],
  });

export type AdInput = z.infer<typeof adInputSchema>;

/** Edits: any subset of fields. The content refine runs against the merged record in the route. */
export const adUpdateSchema = z.object(adFields).partial().strip();
export type AdUpdate = z.infer<typeof adUpdateSchema>;

export function hasResearchContent(ad: Pick<AdInput, "headline" | "ad_copy" | "creative_description">) {
  return Boolean(ad.headline || ad.ad_copy || ad.creative_description);
}

/** Maps zod issues to { field: firstMessage } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}
