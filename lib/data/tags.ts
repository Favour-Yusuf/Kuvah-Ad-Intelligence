import "server-only";
import { toDataError, type Db } from "./client";

export async function listTagNames(db: Db): Promise<string[]> {
  const { data, error } = await db.from("tags").select("name").order("name");
  if (error) throw toDataError(error, "load tags");
  return data.map((t) => t.name);
}

export async function getAdTags(db: Db, adId: string): Promise<string[]> {
  const { data, error } = await db.from("ad_tags").select("tags(name)").eq("ad_id", adId);
  if (error) throw toDataError(error, "load tags");
  return data
    .map((row) => (row.tags as { name: string } | null)?.name)
    .filter((n): n is string => Boolean(n))
    .sort((a, b) => a.localeCompare(b));
}

/** Replaces an ad's tags with `names`, creating any tags that do not exist yet. */
export async function setAdTags(db: Db, adId: string, names: string[]): Promise<string[]> {
  let tagIds: string[] = [];
  if (names.length) {
    const { data: existing, error } = await db.from("tags").select("id, name");
    if (error) throw toDataError(error, "load tags");
    const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]));
    const missing = names.filter((n) => !byName.has(n.toLowerCase()));
    if (missing.length) {
      // ignoreDuplicates: another member may create the same tag concurrently.
      const { error: insertError } = await db
        .from("tags")
        .upsert(missing.map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: true });
      if (insertError) throw toDataError(insertError, "create tags");
      const { data: created, error: reloadError } = await db.from("tags").select("id, name");
      if (reloadError) throw toDataError(reloadError, "load tags");
      for (const t of created) byName.set(t.name.toLowerCase(), t.id);
    }
    tagIds = names.map((n) => byName.get(n.toLowerCase())).filter((id): id is string => Boolean(id));
  }

  const { error: clearError } = await db.from("ad_tags").delete().eq("ad_id", adId);
  if (clearError) throw toDataError(clearError, "update tags");
  if (tagIds.length) {
    const { error: linkError } = await db.from("ad_tags").insert(tagIds.map((tag_id) => ({ ad_id: adId, tag_id })));
    if (linkError) throw toDataError(linkError, "update tags");
  }
  return getAdTags(db, adId);
}
