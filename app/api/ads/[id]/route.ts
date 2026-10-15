import { NextResponse, type NextRequest } from "next/server";
import { checkSameOrigin, handleError, jsonError, parseId, readJson } from "@/lib/api";
import { requireMemberApi } from "@/lib/auth";
import { deleteAd, getAd, updateAd } from "@/lib/data/ads";
import { removeCreative } from "@/lib/data/creatives";
import { adUpdateSchema, hasResearchContent } from "@/lib/validation/ad";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/ads/[id]">) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const id = parseId((await ctx.params).id);
  if (!id) return jsonError("Ad not found.", 404);
  const auth = await requireMemberApi();
  if (!auth.ok) return auth.response;

  const body = await readJson(request, adUpdateSchema);
  if (!body.ok) return body.response;

  try {
    const current = await getAd(auth.supabase, id);
    if (!current) return jsonError("Ad not found.", 404);

    const merged = { ...current, ...body.data };
    if (!hasResearchContent(merged)) {
      return jsonError("Check the highlighted fields.", 422, {
        ad_copy: "Add the headline, ad copy or a creative description.",
      });
    }

    const ad = await updateAd(auth.supabase, id, body.data);
    if ("creative_path" in body.data && current.creative_path && current.creative_path !== ad.creative_path) {
      await removeCreative(auth.supabase, current.creative_path);
    }
    return NextResponse.json({ ad });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/ads/[id]">) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const id = parseId((await ctx.params).id);
  if (!id) return jsonError("Ad not found.", 404);
  const auth = await requireMemberApi();
  if (!auth.ok) return auth.response;

  try {
    const { creativePath } = await deleteAd(auth.supabase, id);
    await removeCreative(auth.supabase, creativePath);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
