import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type Db = SupabaseClient<Database>;

/** A data-layer failure with a message that is safe to show to the user. */
export class DataError extends Error {
  constructor(
    message: string,
    readonly status: number = 500,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DataError";
  }
}

/** Translates a PostgREST error into a DataError without leaking internals. */
export function toDataError(error: { code?: string; message?: string } | null, action: string): DataError {
  if (!error) return new DataError(`Could not ${action}.`);
  if (error.code === "42501") return new DataError(`You do not have permission to ${action}.`, 403, error);
  if (error.code === "23505") return new DataError(`Could not ${action}: it already exists.`, 409, error);
  if (error.code === "23503") return new DataError(`Could not ${action}: a related record is missing.`, 409, error);
  if (error.code === "23514" || error.code === "22P02") return new DataError(`Could not ${action}: invalid data.`, 400, error);
  return new DataError(`Could not ${action}. Try again.`, 500, error);
}
