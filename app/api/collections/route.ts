import { NextResponse, type NextRequest } from "next/server";
import { checkSameOrigin, handleError, readJson } from "@/lib/api";
import { requireMemberApi } from "@/lib/auth";
import { addItems, createCollection } from "@/lib/data/collections";
import { collectionInputSchema } from "@/lib/validation/organise";
import { uuid } from "@/lib/validation/text";
import { z } from "zod";

/** Create a collection, optionally seeding it with selected ads. */
const createSchema = collectionInputSchema.extend({ ad_ids: z.array(uuid).max(100).optional() });

export async function POST(request: NextRequest) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const auth = await requireMemberApi();
  if (!auth.ok) return auth.response;

  const body = await readJson(request, createSchema);
  if (!body.ok) return body.response;

  try {
    const collection = await createCollection(auth.supabase, { name: body.data.name, description: body.data.description });
    const added = body.data.ad_ids?.length ? (await addItems(auth.supabase, collection.id, body.data.ad_ids, null)).added : 0;
    return NextResponse.json({ collection, added }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
