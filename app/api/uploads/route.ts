import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkSameOrigin, handleError, readJson } from "@/lib/api";
import { requireMemberApi } from "@/lib/auth";
import { CREATIVE_TYPES, MAX_CREATIVE_BYTES, createUploadUrl, creativePath, type CreativeType } from "@/lib/data/creatives";

const uploadSchema = z
  .object({
    content_type: z.enum(Object.keys(CREATIVE_TYPES) as [CreativeType, ...CreativeType[]], {
      error: "Upload a JPG, PNG, WebP or MP4 file.",
    }),
    size: z.number().int().positive().max(MAX_CREATIVE_BYTES, "Files must be 25 MB or smaller."),
    permission_confirmed: z.literal(true, {
      error: "Confirm the team may store this creative for internal research.",
    }),
  })
  .strip();

/**
 * Issues a one-time signed upload URL. The browser uploads the file directly to
 * Storage; the bucket enforces type and size again on its side.
 */
export async function POST(request: NextRequest) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const auth = await requireMemberApi();
  if (!auth.ok) return auth.response;

  const body = await readJson(request, uploadSchema);
  if (!body.ok) return body.response;

  try {
    const path = creativePath(auth.member.id, body.data.content_type);
    const { token } = await createUploadUrl(auth.supabase, path);
    return NextResponse.json({ path, token }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
