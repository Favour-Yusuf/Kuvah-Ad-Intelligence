import { beforeAll, describe, expect, it } from "vitest";
import { asUser, asUserCommit, createTestDb, type TestDb } from "./db";

const ADMIN = "00000000-0000-4000-8000-00000000000a";
const MEMBER = "00000000-0000-4000-8000-00000000000b";
const OUTSIDER = "00000000-0000-4000-8000-00000000000c";

const INSERT_AD = `
  insert into public.ads (source_url, brand, platform, target_country, format, observed_at, created_by)
  values ($1, $2, 'facebook', 'US', 'image', current_date, $3)
  returning id, created_by`;

let db: TestDb;
let adminAdId: string;

beforeAll(async () => {
  db = await createTestDb();
  await db.query("insert into auth.users (id, email) values ($1, 'a@x.test'), ($2, 'b@x.test'), ($3, 'c@x.test')", [
    ADMIN,
    MEMBER,
    OUTSIDER,
  ]);
  await db.query("insert into public.team_members (user_id, role) values ($1, 'admin'), ($2, 'member')", [
    ADMIN,
    MEMBER,
  ]);
  const ad = await asUserCommit<{ id: string }>(db, ADMIN, INSERT_AD, ["https://example.com/a", "Admin ad", null]);
  adminAdId = ad.rows[0].id;
}, 60_000);

describe("schema", () => {
  it("applies every migration", async () => {
    const res = await db.query<{ n: number }>(
      "select count(*)::int as n from pg_tables where schemaname = 'public'",
    );
    expect(res.rows[0].n).toBe(8);
  });

  it("enforces https source URLs", async () => {
    await expect(asUser(db, MEMBER, INSERT_AD, ["http://example.com", "Brand", null])).rejects.toThrow(/source_url/);
  });

  it("loads the demo seed", async () => {
    const { readFileSync } = await import("node:fs");
    const seed = readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(seed);
      const ads = await tx.query<{ n: number }>("select count(*)::int as n from public.ads where brand like 'Demo:%'");
      const items = await tx.query<{ n: number }>("select count(*)::int as n from public.collection_items");
      expect(ads.rows[0].n).toBe(3);
      expect(items.rows[0].n).toBe(3);
      await tx.rollback();
    });
  });

  it("treats tag names case-insensitively", async () => {
    await expect(
      asUser(db, MEMBER, "insert into public.tags (name) values ('Hooks'), ('hooks')"),
    ).rejects.toThrow(/unique|duplicate/i);
  });
});

describe("visitors outside the team", () => {
  it("anonymous visitors cannot read ads", async () => {
    await expect(asUser(db, null, "select * from public.ads")).rejects.toThrow(/permission denied/);
  });

  it("signed-in non-members see nothing", async () => {
    const res = await asUser(db, OUTSIDER, "select id from public.ads");
    expect(res.rows).toHaveLength(0);
  });

  it("signed-in non-members cannot create ads", async () => {
    await expect(asUser(db, OUTSIDER, INSERT_AD, ["https://example.com/c", "Nope", null])).rejects.toThrow(
      /row-level security/,
    );
  });

  it("signed-in non-members cannot upload creatives", async () => {
    await expect(
      asUser(db, OUTSIDER, "insert into storage.objects (bucket_id, name, owner_id) values ('creatives', 'x.png', $1)", [
        OUTSIDER,
      ]),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("team members", () => {
  it("can read the team's ads through the library view", async () => {
    const res = await asUser<{ analysis_status: string }>(
      db,
      MEMBER,
      "select analysis_status from public.ad_library where id = $1",
      [adminAdId],
    );
    expect(res.rows[0].analysis_status).toBe("none");
  });

  it("cannot spoof created_by when creating an ad", async () => {
    const res = await asUser<{ created_by: string }>(db, MEMBER, INSERT_AD, ["https://example.com/b", "Mine", ADMIN]);
    expect(res.rows[0].created_by).toBe(MEMBER);
  });

  it("can edit another member's ad but not take ownership", async () => {
    const res = await asUser<{ brand: string; created_by: string }>(
      db,
      MEMBER,
      "update public.ads set brand = 'Edited', created_by = $2 where id = $1 returning brand, created_by",
      [adminAdId, MEMBER],
    );
    expect(res.rows[0]).toEqual({ brand: "Edited", created_by: ADMIN });
  });

  it("cannot delete an ad someone else captured", async () => {
    const res = await asUser(db, MEMBER, "delete from public.ads where id = $1", [adminAdId]);
    expect(res.affectedRows).toBe(0);
  });

  it("can start a pending analysis but not write a result", async () => {
    const ok = await asUser<{ status: string }>(
      db,
      MEMBER,
      "insert into public.ad_analyses (ad_id, provider, model, input_hash) values ($1, 'fake', 'm', repeat('a', 64)) returning status",
      [adminAdId],
    );
    expect(ok.rows[0].status).toBe("pending");

    await expect(
      asUser(
        db,
        MEMBER,
        "insert into public.ad_analyses (ad_id, status, provider, model, input_hash, result) values ($1, 'complete', 'fake', 'm', repeat('a', 64), '{}')",
        [adminAdId],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot update analyses (only the server completes them)", async () => {
    await db.query(
      "insert into public.ad_analyses (ad_id, provider, model, input_hash, created_by) values ($1, 'fake', 'm', repeat('b', 64), $2)",
      [adminAdId, MEMBER],
    );
    const res = await asUser(db, MEMBER, "update public.ad_analyses set status = 'complete' where ad_id = $1", [
      adminAdId,
    ]);
    expect(res.affectedRows).toBe(0);
  });

  it("cannot add people to the team", async () => {
    await expect(
      asUser(db, MEMBER, "insert into public.team_members (user_id) values ($1)", [OUTSIDER]),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot edit another member's note", async () => {
    const note = await asUserCommit<{ id: string }>(
      db,
      ADMIN,
      "insert into public.ad_notes (ad_id, body) values ($1, 'Admin note') returning id",
      [adminAdId],
    );
    const res = await asUser(db, MEMBER, "update public.ad_notes set body = 'hijack' where id = $1", [
      note.rows[0].id,
    ]);
    expect(res.affectedRows).toBe(0);
  });

  it("can upload creatives", async () => {
    const res = await asUser(
      db,
      MEMBER,
      "insert into storage.objects (bucket_id, name, owner_id) values ('creatives', 'ok.png', $1)",
      [MEMBER],
    );
    expect(res.affectedRows).toBe(1);
  });
});

describe("admins", () => {
  it("can delete an ad another member captured", async () => {
    const memberAd = await asUserCommit<{ id: string }>(db, MEMBER, INSERT_AD, [
      "https://example.com/m",
      "Member ad",
      null,
    ]);
    const res = await asUser(db, ADMIN, "delete from public.ads where id = $1", [memberAd.rows[0].id]);
    expect(res.affectedRows).toBe(1);
  });

  it("can add people to the team", async () => {
    const res = await asUser(db, ADMIN, "insert into public.team_members (user_id) values ($1)", [OUTSIDER]);
    expect(res.affectedRows).toBe(1);
  });
});
