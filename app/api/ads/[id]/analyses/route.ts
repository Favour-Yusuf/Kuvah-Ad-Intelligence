import { NextResponse, type NextRequest } from "next/server";
import { checkSameOrigin, handleError, jsonError, parseId } from "@/lib/api";
import { requireMemberApi } from "@/lib/auth";
import { getAnalyzer } from "@/lib/analysis";
import { RATE_LIMIT, runAnalysis } from "@/lib/analysis/run";
import { getAd } from "@/lib/data/ads";
import { countRecentRuns } from "@/lib/data/analyses";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasResearchContent } from "@/lib/validation/ad";

// Analyses can take up to the analyzer deadline plus storage round-trips.
export const maxDuration = 120;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/ads/[id]/analyses">) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const id = parseId((await ctx.params).id);
  if (!id) return jsonError("Ad not found.", 404);
  const auth = await requireMemberApi();
  if (!auth.ok) return auth.response;

  try {
    const recent = await countRecentRuns(auth.supabase, auth.member.id, RATE_LIMIT.windowMs);
    if (recent >= RATE_LIMIT.runs) {
      return NextResponse.json(
        { error: `You can run ${RATE_LIMIT.runs} analyses a minute. Wait a moment and try again.` },
        { status: 429, headers: { "retry-after": "60" } },
      );
    }

    const ad = await getAd(auth.supabase, id);
    if (!ad) return jsonError("Ad not found.", 404);
    if (!hasResearchContent(ad)) {
      return jsonError("Add the headline, ad copy or a creative description before analysing.", 422);
    }

    const analysis = await runAnalysis({ db: auth.supabase, admin: createAdminClient(), analyzer: getAnalyzer() }, ad);
    return NextResponse.json({ analysis }, { status: analysis.status === "complete" ? 201 : 502 });
  } catch (error) {
    return handleError(error);
  }
}
