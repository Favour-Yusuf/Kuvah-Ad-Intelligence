import { NextResponse, type NextRequest } from "next/server";
import { checkSameOrigin, handleError, jsonError, parseId, readJson } from "@/lib/api";
import { requireMemberApi } from "@/lib/auth";
import { getAd } from "@/lib/data/ads";
import { setAdTags } from "@/lib/data/tags";
import { adTagsSchema } from "@/lib/validation/organise";

/** Replaces the ad's tags with the submitted list. */
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/ads/[id]/tags">) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const id = parseId((await ctx.params).id);
  if (!id) return jsonError("Ad not found.", 404);
  const auth = await requireMemberApi();
  if (!auth.ok) return auth.response;

  const body = await readJson(request, adTagsSchema);
  if (!body.ok) return body.response;

  try {
    if (!(await getAd(auth.supabase, id))) return jsonError("Ad not found.", 404);
    return NextResponse.json({ tags: await setAdTags(auth.supabase, id, body.data.tags) });
  } catch (error) {
    return handleError(error);
  }
}
