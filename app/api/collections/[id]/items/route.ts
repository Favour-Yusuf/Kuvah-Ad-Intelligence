import { NextResponse, type NextRequest } from "next/server";
import { checkSameOrigin, handleError, jsonError, parseId, readJson } from "@/lib/api";
import { requireMemberApi } from "@/lib/auth";
import { addItems, removeItem, updateItemNote } from "@/lib/data/collections";
import { collectionItemRemoveSchema, collectionItemUpdateSchema, collectionItemsAddSchema } from "@/lib/validation/organise";

/** Shared checks. Returns a ready response on failure, otherwise the collection id and client. */
async function setup(request: NextRequest, ctx: RouteContext<"/api/collections/[id]/items">) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const id = parseId((await ctx.params).id);
  if (!id) return jsonError("Collection not found.", 404);
  const auth = await requireMemberApi();
  if (!auth.ok) return auth.response;
  return { id, db: auth.supabase };
}

/** Add one or more ads. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/collections/[id]/items">) {
  const s = await setup(request, ctx);
  if (s instanceof NextResponse) return s;
  const body = await readJson(request, collectionItemsAddSchema);
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await addItems(s.db, s.id, body.data.ad_ids, body.data.note), { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

/** Edit an item's note. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/collections/[id]/items">) {
  const s = await setup(request, ctx);
  if (s instanceof NextResponse) return s;
  const body = await readJson(request, collectionItemUpdateSchema);
  if (!body.ok) return body.response;
  try {
    await updateItemNote(s.db, s.id, body.data.ad_id, body.data.note);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}

/** Remove an ad from the collection (the ad itself is kept). */
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/collections/[id]/items">) {
  const s = await setup(request, ctx);
  if (s instanceof NextResponse) return s;
  const body = await readJson(request, collectionItemRemoveSchema);
  if (!body.ok) return body.response;
  try {
    await removeItem(s.db, s.id, body.data.ad_id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
