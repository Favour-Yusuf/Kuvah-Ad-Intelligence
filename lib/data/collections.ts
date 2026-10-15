import "server-only";
import type { AdLibraryRow, CollectionRow } from "@/lib/supabase/types";
import { DataError, toDataError, type Db } from "./client";

export type CollectionSummary = CollectionRow & { item_count: number; last_added_at: string | null };
export type CollectionItem = { ad: AdLibraryRow; note: string | null; added_at: string; added_by: string | null };

export async function listCollections(db: Db): Promise<CollectionSummary[]> {
  const [{ data: collections, error }, { data: items, error: itemsError }] = await Promise.all([
    db.from("collections").select("*").order("updated_at", { ascending: false }),
    db.from("collection_items").select("collection_id, added_at"),
  ]);
  if (error) throw toDataError(error, "load collections");
  if (itemsError) throw toDataError(itemsError, "load collections");

  const stats = new Map<string, { count: number; last: string | null }>();
  for (const item of items) {
    const s = stats.get(item.collection_id) ?? { count: 0, last: null };
    s.count += 1;
    if (!s.last || item.added_at > s.last) s.last = item.added_at;
    stats.set(item.collection_id, s);
  }
  const activity = (c: CollectionSummary) =>
    c.last_added_at && c.last_added_at > c.updated_at ? c.last_added_at : c.updated_at;
  return collections
    .map((c) => ({ ...c, item_count: stats.get(c.id)?.count ?? 0, last_added_at: stats.get(c.id)?.last ?? null }))
    .sort((a, b) => activity(b).localeCompare(activity(a)));
}

/** Minimal list for pickers. */
export async function listCollectionOptions(db: Db): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db.from("collections").select("id, name").order("name");
  if (error) throw toDataError(error, "load collections");
  return data;
}

export async function getCollection(db: Db, id: string): Promise<{ collection: CollectionRow; items: CollectionItem[] } | null> {
  const { data: collection, error } = await db.from("collections").select("*").eq("id", id).maybeSingle();
  if (error) throw toDataError(error, "load the collection");
  if (!collection) return null;

  const { data: links, error: linkError } = await db
    .from("collection_items")
    .select("ad_id, note, added_at, added_by")
    .eq("collection_id", id)
    .order("added_at", { ascending: false });
  if (linkError) throw toDataError(linkError, "load the collection");

  const ids = links.map((l) => l.ad_id);
  const ads = new Map<string, AdLibraryRow>();
  if (ids.length) {
    const { data, error: adsError } = await db.from("ad_library").select("*").in("id", ids);
    if (adsError) throw toDataError(adsError, "load the collection");
    for (const ad of data) ads.set(ad.id, ad);
  }

  const items = links
    .filter((l) => ads.has(l.ad_id))
    .map((l) => ({ ad: ads.get(l.ad_id)!, note: l.note, added_at: l.added_at, added_by: l.added_by }));
  return { collection, items };
}

export async function createCollection(db: Db, input: { name: string; description: string | null }) {
  const { data, error } = await db.from("collections").insert(input).select("*").single();
  if (error) throw toDataError(error, "create the collection");
  return data;
}

export async function updateCollection(db: Db, id: string, patch: { name?: string; description?: string | null }) {
  const { data, error } = await db.from("collections").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) throw toDataError(error, "update the collection");
  if (!data) throw new DataError("Collection not found.", 404);
  return data;
}

export async function deleteCollection(db: Db, id: string) {
  const { data, error } = await db.from("collections").delete().eq("id", id).select("id");
  if (error) throw toDataError(error, "delete the collection");
  if (!data.length) throw new DataError("Only the person who created this collection, or an admin, can delete it.", 403);
}

/** Adds ads, skipping any already in the collection. Returns how many were new. */
export async function addItems(db: Db, collectionId: string, adIds: string[], note: string | null) {
  const { data: existing, error } = await db
    .from("collection_items")
    .select("ad_id")
    .eq("collection_id", collectionId)
    .in("ad_id", adIds);
  if (error) throw toDataError(error, "add to the collection");
  const have = new Set(existing.map((e) => e.ad_id));
  const fresh = adIds.filter((id) => !have.has(id));
  if (fresh.length) {
    const { error: insertError } = await db
      .from("collection_items")
      .upsert(fresh.map((ad_id) => ({ collection_id: collectionId, ad_id, note })), {
        onConflict: "collection_id,ad_id",
        ignoreDuplicates: true,
      });
    if (insertError) throw toDataError(insertError, "add to the collection");
  }
  return { added: fresh.length, skipped: adIds.length - fresh.length };
}

export async function updateItemNote(db: Db, collectionId: string, adId: string, note: string | null) {
  const { data, error } = await db
    .from("collection_items")
    .update({ note })
    .eq("collection_id", collectionId)
    .eq("ad_id", adId)
    .select("ad_id");
  if (error) throw toDataError(error, "update the note");
  if (!data.length) throw new DataError("That ad is not in this collection.", 404);
}

export async function removeItem(db: Db, collectionId: string, adId: string) {
  const { data, error } = await db
    .from("collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("ad_id", adId)
    .select("ad_id");
  if (error) throw toDataError(error, "remove the ad");
  if (!data.length) throw new DataError("Only the person who added this ad, or an admin, can remove it.", 403);
}

export async function collectionsForAd(db: Db, adId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db.from("collection_items").select("collections(id, name)").eq("ad_id", adId);
  if (error) throw toDataError(error, "load collections");
  return data
    .map((r) => r.collections as { id: string; name: string } | null)
    .filter((c): c is { id: string; name: string } => Boolean(c))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type CollectionActivity = { collection_id: string; collection_name: string; ad_id: string; brand: string; added_at: string; added_by: string | null };

export async function recentCollectionActivity(db: Db, limit = 8): Promise<CollectionActivity[]> {
  const { data, error } = await db
    .from("collection_items")
    .select("collection_id, ad_id, added_at, added_by, collections(name), ads(brand)")
    .order("added_at", { ascending: false })
    .limit(limit);
  if (error) throw toDataError(error, "load collection activity");
  return data.map((r) => ({
    collection_id: r.collection_id,
    collection_name: (r.collections as { name: string } | null)?.name ?? "Collection",
    ad_id: r.ad_id,
    brand: (r.ads as { brand: string } | null)?.brand ?? "Ad",
    added_at: r.added_at,
    added_by: r.added_by,
  }));
}
