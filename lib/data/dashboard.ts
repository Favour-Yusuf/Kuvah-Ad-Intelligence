import "server-only";
import { summarise, type DashboardRow } from "@/lib/dashboard";
import type { AdLibraryRow } from "@/lib/supabase/types";
import { toDataError, type Db } from "./client";
import { listCollections, recentCollectionActivity } from "./collections";

export async function getDashboard(db: Db) {
  const [{ data: rows, error }, { data: recent, error: recentError }, collections, activity] = await Promise.all([
    db.from("ad_library").select("platform, target_country, analysis_status").limit(10_000),
    db.from("ad_library").select("*").order("created_at", { ascending: false }).limit(10),
    listCollections(db),
    recentCollectionActivity(db, 8),
  ]);
  if (error) throw toDataError(error, "load the dashboard");
  if (recentError) throw toDataError(recentError, "load recent captures");

  return {
    summary: summarise(rows as DashboardRow[]),
    recent: recent as AdLibraryRow[],
    collectionCount: collections.length,
    activity,
  };
}
