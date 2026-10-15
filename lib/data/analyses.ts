import "server-only";
import type { AdAnalysisRow, AnalysisStatus, Json } from "@/lib/supabase/types";
import { toDataError, type Db } from "./client";

/** Runs left "pending" longer than this are treated as failed (e.g. the server restarted mid-run). */
export const STALE_PENDING_MS = 3 * 60 * 1000;

export function effectiveStatus(row: Pick<AdAnalysisRow, "status" | "created_at">, now = Date.now()): AnalysisStatus {
  if (row.status === "pending" && now - new Date(row.created_at).getTime() > STALE_PENDING_MS) return "failed";
  return row.status;
}

export async function countRecentRuns(db: Db, userId: string, windowMs: number): Promise<number> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await db
    .from("ad_analyses")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId)
    .gte("created_at", since);
  if (error) throw toDataError(error, "check your recent analyses");
  return count ?? 0;
}

/** Inserted with the user's client, so RLS confirms membership and stamps the author. */
export async function startAnalysis(db: Db, row: { ad_id: string; provider: string; model: string; input_hash: string }) {
  const { data, error } = await db.from("ad_analyses").insert({ ...row, status: "pending" }).select("*").single();
  if (error) throw toDataError(error, "start the analysis");
  return data;
}

/** Completion uses the secret-key client: members cannot write results directly. */
export async function finishAnalysis(
  admin: Db,
  id: string,
  outcome: { status: "complete"; result: Json; warnings: string[] } | { status: "failed"; error: string },
) {
  const patch =
    outcome.status === "complete"
      ? { status: "complete" as const, result: outcome.result, warnings: outcome.warnings, error: null }
      : { status: "failed" as const, error: outcome.error.slice(0, 1000) };
  const { data, error } = await admin
    .from("ad_analyses")
    .update({ ...patch, completed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw toDataError(error, "save the analysis");
  return data;
}

/** Presents runs stuck in "pending" past the deadline as failed, so the UI never waits forever. */
export function resolveStale<T extends AdAnalysisRow>(row: T, now = Date.now()): T {
  if (effectiveStatus(row, now) === row.status) return row;
  return { ...row, status: "failed", error: row.error ?? "This analysis did not finish. Run it again." };
}

export async function listAnalysesForAd(db: Db, adId: string): Promise<AdAnalysisRow[]> {
  const { data, error } = await db
    .from("ad_analyses")
    .select("*")
    .eq("ad_id", adId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw toDataError(error, "load analyses");
  const now = Date.now();
  return data.map((row) => resolveStale(row, now));
}

/** Latest complete analysis per ad, for comparison views. */
export async function latestCompleteByAd(db: Db, adIds: string[]): Promise<Map<string, AdAnalysisRow>> {
  const map = new Map<string, AdAnalysisRow>();
  if (!adIds.length) return map;
  const { data, error } = await db
    .from("ad_analyses")
    .select("*")
    .in("ad_id", adIds)
    .eq("status", "complete")
    .order("created_at", { ascending: false });
  if (error) throw toDataError(error, "load analyses");
  for (const row of data) if (!map.has(row.ad_id)) map.set(row.ad_id, row);
  return map;
}

export type AnalysisListItem = AdAnalysisRow & { ads: { brand: string; platform: string; headline: string | null } | null };

export async function listRecentAnalyses(
  db: Db,
  opts: { status: AnalysisStatus | null; page: number; pageSize: number },
): Promise<{ rows: AnalysisListItem[]; total: number }> {
  let query = db
    .from("ad_analyses")
    .select("*, ads(brand, platform, headline)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (opts.status) query = query.eq("status", opts.status);
  const from = (opts.page - 1) * opts.pageSize;
  const { data, count, error } = await query.range(from, from + opts.pageSize - 1);
  if (error) throw toDataError(error, "load analyses");
  const now = Date.now();
  return { rows: (data as AnalysisListItem[]).map((row) => resolveStale(row, now)), total: count ?? 0 };
}
