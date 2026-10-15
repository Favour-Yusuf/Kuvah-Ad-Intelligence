import "server-only";
import type { AdInput, AdUpdate } from "@/lib/validation/ad";
import { PAGE_SIZE } from "@/lib/validation/constants";
import type { LibraryFilters } from "@/lib/validation/filters";
import type { AdLibraryRow, AdRow } from "@/lib/supabase/types";
import { DataError, toDataError, type Db } from "./client";

export type AdPage = { rows: AdLibraryRow[]; total: number; page: number; pageCount: number };

/** Ad ids carrying a tag (case-insensitive). Null when the tag does not exist. */
async function adIdsForTag(db: Db, tag: string): Promise<string[] | null> {
  const { data: tagRow, error } = await db.from("tags").select("id").ilike("name", tag).maybeSingle();
  if (error) throw toDataError(error, "load tags");
  if (!tagRow) return null;
  const { data, error: linkError } = await db.from("ad_tags").select("ad_id").eq("tag_id", tagRow.id);
  if (linkError) throw toDataError(linkError, "load tags");
  return data.map((r) => r.ad_id);
}

export async function listAds(db: Db, filters: LibraryFilters): Promise<AdPage> {
  let tagIds: string[] | null = null;
  if (filters.tag) {
    tagIds = await adIdsForTag(db, filters.tag);
    if (!tagIds || tagIds.length === 0) return { rows: [], total: 0, page: 1, pageCount: 0 };
  }

  let query = db.from("ad_library").select("*", { count: "exact" });
  if (filters.q) query = query.textSearch("search", filters.q, { type: "websearch", config: "simple" });
  if (filters.platforms.length) query = query.in("platform", filters.platforms);
  if (filters.countries.length) query = query.in("target_country", filters.countries);
  if (filters.formats.length) query = query.in("format", filters.formats);
  if (filters.industry) query = query.ilike("industry", escapeLike(filters.industry));
  if (filters.angle) query = query.ilike("marketing_angle", escapeLike(filters.angle));
  if (filters.status) query = query.eq("analysis_status", filters.status);
  if (tagIds) query = query.in("id", tagIds);

  const orderColumn = filters.sort === "captured" ? "created_at" : "observed_at";
  const from = (filters.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order(orderColumn, { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw toDataError(error, "load the ad library");
  const total = count ?? 0;
  return { rows: data, total, page: filters.page, pageCount: Math.ceil(total / PAGE_SIZE) };
}

/** Exact, case-insensitive match for ilike: escapes wildcard characters. */
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function getAd(db: Db, id: string): Promise<AdLibraryRow | null> {
  const { data, error } = await db.from("ad_library").select("*").eq("id", id).maybeSingle();
  if (error) throw toDataError(error, "load the ad");
  return data;
}

export async function getAdsByIds(db: Db, ids: string[]): Promise<AdLibraryRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from("ad_library").select("*").in("id", ids);
  if (error) throw toDataError(error, "load ads");
  const order = new Map(ids.map((id, i) => [id, i]));
  return data.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function createAd(db: Db, input: AdInput, sourceType = "manual"): Promise<AdRow> {
  const { data, error } = await db
    .from("ads")
    .insert({ ...input, source_type: sourceType })
    .select("*")
    .single();
  if (error) throw toDataError(error, "save the ad");
  return data;
}

export async function updateAd(db: Db, id: string, patch: AdUpdate): Promise<AdRow> {
  const { data, error } = await db.from("ads").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) throw toDataError(error, "update the ad");
  if (!data) throw new DataError("Ad not found.", 404);
  return data;
}

/** Returns the deleted ad's creative path so the caller can remove the file. */
export async function deleteAd(db: Db, id: string): Promise<{ creativePath: string | null }> {
  const { data, error } = await db.from("ads").delete().eq("id", id).select("creative_path");
  if (error) throw toDataError(error, "delete the ad");
  // RLS hides rows the user may not delete, so zero rows means "not yours" or "gone".
  if (data.length === 0) throw new DataError("Only the person who captured this ad, or an admin, can delete it.", 403);
  return { creativePath: data[0].creative_path };
}

/** Distinct non-empty values of a text column, for filter and form suggestions. */
export async function distinctValues(db: Db, column: "industry" | "marketing_angle"): Promise<string[]> {
  const { data, error } = await db.from("ads").select(column).not(column, "is", null).limit(1000);
  if (error) throw toDataError(error, "load suggestions");
  const values = new Map<string, string>();
  for (const row of data as Record<string, string | null>[]) {
    const v = row[column]?.trim();
    if (v && !values.has(v.toLowerCase())) values.set(v.toLowerCase(), v);
  }
  return [...values.values()].sort((a, b) => a.localeCompare(b));
}
