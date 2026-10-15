import { NextResponse, type NextRequest } from "next/server";
import { checkSameOrigin, handleError, jsonError, parseId } from "@/lib/api";
import { requireMemberApi } from "@/lib/auth";
import { deleteNote } from "@/lib/data/notes";

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/notes/[id]">) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const id = parseId((await ctx.params).id);
  if (!id) return jsonError("Note not found.", 404);
  const auth = await requireMemberApi();
  if (!auth.ok) return auth.response;

  try {
    await deleteNote(auth.supabase, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
