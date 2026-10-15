import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";

const here = import.meta.dirname;
const root = join(here, "..", "..");

/** Boots an in-memory Postgres with the Supabase shim and every migration applied. */
export async function createTestDb() {
  const db = await PGlite.create({ extensions: { citext } });
  await db.exec(readFileSync(join(here, "supabase-shim.sql"), "utf8"));

  const dir = join(root, "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/**
 * Runs `sql` as a signed-in user (authenticated role with a JWT sub claim),
 * or as an anonymous visitor when `userId` is null. Always rolls back.
 */
export async function asUser<T = Record<string, unknown>>(
  db: TestDb,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    const result = await tx.query<T>(sql, params);
    await tx.rollback();
    return result;
  });
}

/** Like asUser, but commits so later assertions can see the change. */
export async function asUserCommit<T = Record<string, unknown>>(
  db: TestDb,
  userId: string,
  sql: string,
  params: unknown[] = [],
) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    return tx.query<T>(sql, params);
  });
}
