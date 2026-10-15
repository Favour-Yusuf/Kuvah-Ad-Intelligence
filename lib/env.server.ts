import "server-only";
import { parseServerEnv, type ServerEnv } from "./env";

let cached: ServerEnv | undefined;

/** Server-only secrets. Importing this from a Client Component fails the build. */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
