import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { DataError } from "@/lib/data/client";
import { fieldErrors } from "@/lib/validation/ad";
import { uuid } from "@/lib/validation/text";

const MAX_BODY_BYTES = 64 * 1024;

export function jsonError(message: string, status: number, fields?: Record<string, string>) {
  return NextResponse.json(fields ? { error: message, fields } : { error: message }, { status });
}

/**
 * Rejects cross-site writes. Browsers always send Origin on fetch POST/PATCH/
 * PUT/DELETE, so a mismatch means the request did not come from this app.
 */
export function checkSameOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return jsonError("Cross-site request blocked.", 403);
  return null;
}

/** Reads and validates a JSON body against a zod schema. */
export async function readJson<S extends z.ZodType>(
  request: NextRequest,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return { ok: false, response: jsonError("Request is too large.", 413) };

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return { ok: false, response: jsonError("Request is too large.", 413) };
    body = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, response: jsonError("Request body must be valid JSON.", 400) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: jsonError("Check the highlighted fields.", 422, fieldErrors(parsed.error)) };
  }
  return { ok: true, data: parsed.data };
}

/** Validates a dynamic [id] route segment. */
export function parseId(id: string): string | null {
  const result = uuid.safeParse(id);
  return result.success ? result.data : null;
}

/** Converts thrown errors into JSON responses without leaking internals. */
export function handleError(error: unknown) {
  if (error instanceof DataError) {
    if (error.status >= 500) console.error(error.message, error.cause);
    return jsonError(error.message, error.status);
  }
  console.error(error);
  return jsonError("Something went wrong. Try again.", 500);
}
