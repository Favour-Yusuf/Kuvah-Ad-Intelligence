import { z } from "zod";
import { cleanText, optionalText, requiredText, uuid } from "./text";

export const collectionInputSchema = z
  .object({
    name: requiredText(120, "Collection name"),
    description: optionalText(1000, "Description"),
  })
  .strip();

export const collectionUpdateSchema = collectionInputSchema.partial();

export const collectionItemsAddSchema = z
  .object({
    ad_ids: z.array(uuid).min(1, "Select at least one ad.").max(100, "Add at most 100 ads at a time."),
    note: optionalText(2000, "Note"),
  })
  .strip();

export const collectionItemUpdateSchema = z
  .object({ ad_id: uuid, note: optionalText(2000, "Note") })
  .strip();

export const collectionItemRemoveSchema = z.object({ ad_id: uuid }).strip();

export const noteInputSchema = z.object({ body: requiredText(5000, "Note") }).strip();

export const tagNameSchema = z
  .string()
  .transform((v) => cleanText(v).replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Tag cannot be empty.").max(40, "Tags must be 40 characters or fewer."));

/** Replaces an ad's full tag set. Names are deduplicated case-insensitively. */
export const adTagsSchema = z
  .object({ tags: z.array(tagNameSchema).max(20, "Use at most 20 tags per ad.") })
  .strip()
  .transform(({ tags }) => {
    const seen = new Map<string, string>();
    for (const t of tags) if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
    return { tags: [...seen.values()] };
  });

export const compareIdsSchema = z
  .array(uuid)
  .min(2, "Choose at least two ads to compare.")
  .max(4, "Compare at most four ads at a time.");

export function parseCompareIds(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const ids = [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))];
  return compareIdsSchema.safeParse(ids);
}
