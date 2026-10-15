import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkSameOrigin, handleError, readJson } from "@/lib/api";
import { requireMemberApi } from "@/lib/auth";
import { createAd } from "@/lib/data/ads";
import { manualSource } from "@/lib/sources/manual";

// The manual adapter does the field validation; this only checks the body is an object.
const bodySchema = z.record(z.string(), z.unknown());

export async function POST(request: NextRequest) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const auth = await requireMemberApi();
  if (!auth.ok) return auth.response;

  const body = await readJson(request, bodySchema);
  if (!body.ok) return body.response;

  const draft = manualSource.toAdDraft(body.data);
  if (!draft.ok) return NextResponse.json({ error: "Check the highlighted fields.", fields: draft.errors }, { status: 422 });

  try {
    const ad = await createAd(auth.supabase, draft.draft, manualSource.id);
    return NextResponse.json({ ad }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
