import { NextResponse, type NextRequest } from "next/server";
import { checkSameOrigin, handleError, jsonError, parseId, readJson } from "@/lib/api";
import { requireMemberApi } from "@/lib/auth";
import { deleteCollection, updateCollection } from "@/lib/data/collections";
import { collectionUpdateSchema } from "@/lib/validation/organise";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/collections/[id]">) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const id = parseId((await ctx.params).id);
  if (!id) return jsonError("Collection not found.", 404);
  const auth = await requireMemberApi();
  if (!auth.ok) return auth.response;

  const body = await readJson(request, collectionUpdateSchema);
  if (!body.ok) return body.response;

  try {
    return NextResponse.json({ collection: await updateCollection(auth.supabase, id, body.data) });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/collections/[id]">) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const id = parseId((await ctx.params).id);
  if (!id) return jsonError("Collection not found.", 404);
  const auth = await requireMemberApi();
  if (!auth.ok) return auth.response;

  try {
    await deleteCollection(auth.supabase, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
