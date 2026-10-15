import { NextResponse, type NextRequest } from "next/server";
import { checkSameOrigin, handleError, jsonError, parseId, readJson } from "@/lib/api";
import { requireMemberApi } from "@/lib/auth";
import { addNote } from "@/lib/data/notes";
import { noteInputSchema } from "@/lib/validation/organise";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/ads/[id]/notes">) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const id = parseId((await ctx.params).id);
  if (!id) return jsonError("Ad not found.", 404);
  const auth = await requireMemberApi();
  if (!auth.ok) return auth.response;

  const body = await readJson(request, noteInputSchema);
  if (!body.ok) return body.response;

  try {
    return NextResponse.json({ note: await addNote(auth.supabase, id, body.data.body) }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
