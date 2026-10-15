import "server-only";
import type { Db } from "./client";

export const CREATIVE_BUCKET = "creatives";

export const CREATIVE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
} as const;
export type CreativeType = keyof typeof CREATIVE_TYPES;
export const MAX_CREATIVE_BYTES = 25 * 1024 * 1024;

export function isImagePath(path: string) {
  return /\.(jpg|png|webp)$/.test(path);
}

/** Path layout matches the creative_path validation: ads/<user id>/<random id>.<ext>. */
export function creativePath(userId: string, type: CreativeType) {
  return `ads/${userId}/${crypto.randomUUID()}.${CREATIVE_TYPES[type]}`;
}

export async function createUploadUrl(db: Db, path: string) {
  const { data, error } = await db.storage.from(CREATIVE_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return data;
}

/** Short-lived URL for displaying a private creative. Null if it cannot be signed. */
export async function signedCreativeUrl(db: Db, path: string | null, expiresIn = 60 * 30) {
  if (!path) return null;
  const { data, error } = await db.storage.from(CREATIVE_BUCKET).createSignedUrl(path, expiresIn);
  return error ? null : data.signedUrl;
}

/** Best-effort cleanup; a leftover file is harmless and RLS limits who can delete. */
export async function removeCreative(db: Db, path: string | null) {
  if (!path) return;
  const { error } = await db.storage.from(CREATIVE_BUCKET).remove([path]);
  if (error) console.warn("Could not remove creative", path, error.message);
}

/** Downloads an image creative for analysis. Returns null for videos or on failure. */
export async function downloadImageCreative(db: Db, path: string | null) {
  if (!path || !isImagePath(path)) return null;
  const { data, error } = await db.storage.from(CREATIVE_BUCKET).download(path);
  if (error || !data) return null;
  const mediaType = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return { mediaType, base64: Buffer.from(await data.arrayBuffer()).toString("base64") } as const;
}
