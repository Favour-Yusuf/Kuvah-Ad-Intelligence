import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
// vi.mock calls below are hoisted above these imports.
import * as collectionsRoute from "@/app/api/collections/route";
import * as itemsRoute from "@/app/api/collections/[id]/items/route";
import * as collectionRoute from "@/app/api/collections/[id]/route";
import * as notesRoute from "@/app/api/ads/[id]/notes/route";
import * as noteRoute from "@/app/api/notes/[id]/route";
import * as tagsRoute from "@/app/api/ads/[id]/tags/route";
import { DataError } from "@/lib/data/client";

const MEMBER = { id: "11111111-1111-4111-8111-111111111111", email: null, displayName: "M", role: "member" as const };
const ID = "22222222-2222-4222-8222-222222222222";
const AD = "33333333-3333-4333-8333-333333333333";

const auth = vi.hoisted(() => ({ requireMemberApi: vi.fn() }));
const collections = vi.hoisted(() => ({
  createCollection: vi.fn(),
  addItems: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  updateItemNote: vi.fn(),
  removeItem: vi.fn(),
}));
const notes = vi.hoisted(() => ({ addNote: vi.fn(), deleteNote: vi.fn() }));
const tags = vi.hoisted(() => ({ setAdTags: vi.fn() }));
const ads = vi.hoisted(() => ({ getAd: vi.fn() }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/data/collections", () => collections);
vi.mock("@/lib/data/notes", () => notes);
vi.mock("@/lib/data/tags", () => tags);
vi.mock("@/lib/data/ads", () => ads);


const ORIGIN = "http://localhost:3000";
const req = (method: string, body?: unknown) =>
  new NextRequest(`${ORIGIN}/api/x`, {
    method,
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireMemberApi.mockResolvedValue({ ok: true, supabase: {}, member: MEMBER });
});

describe("collections", () => {
  it("creates a collection and seeds it with selected ads", async () => {
    collections.createCollection.mockResolvedValue({ id: ID, name: "Hooks" });
    collections.addItems.mockResolvedValue({ added: 1, skipped: 0 });
    const res = await collectionsRoute.POST(req("POST", { name: " Hooks ", ad_ids: [AD] }));
    expect(res.status).toBe(201);
    expect(collections.createCollection).toHaveBeenCalledWith({}, { name: "Hooks", description: null });
    expect(collections.addItems).toHaveBeenCalledWith({}, ID, [AD], null);
  });

  it("requires a name", async () => {
    const res = await collectionsRoute.POST(req("POST", { name: "" }));
    expect(res.status).toBe(422);
    expect((await res.json()).fields.name).toMatch(/required/);
  });

  it("validates ad ids when adding items", async () => {
    expect((await itemsRoute.POST(req("POST", { ad_ids: ["nope"] }), ctx())).status).toBe(422);
    expect((await itemsRoute.POST(req("POST", { ad_ids: [] }), ctx())).status).toBe(422);
  });

  it("edits an item note and removes items", async () => {
    expect((await itemsRoute.PATCH(req("PATCH", { ad_id: AD, note: "Strong hook" }), ctx())).status).toBe(204);
    expect(collections.updateItemNote).toHaveBeenCalledWith({}, ID, AD, "Strong hook");
    expect((await itemsRoute.DELETE(req("DELETE", { ad_id: AD }), ctx())).status).toBe(204);
  });

  it("reports when a member may not delete a collection", async () => {
    collections.deleteCollection.mockRejectedValue(new DataError("Only the person who created this collection, or an admin, can delete it.", 403));
    expect((await collectionRoute.DELETE(req("DELETE"), ctx())).status).toBe(403);
  });
});

describe("notes", () => {
  it("adds a cleaned note", async () => {
    notes.addNote.mockResolvedValue({ id: "n1" });
    const res = await notesRoute.POST(req("POST", { body: "  Great opener \u0007 " }), ctx(AD));
    expect(res.status).toBe(201);
    expect(notes.addNote).toHaveBeenCalledWith({}, AD, "Great opener");
  });

  it("rejects empty notes", async () => {
    expect((await notesRoute.POST(req("POST", { body: "   " }), ctx(AD))).status).toBe(422);
  });

  it("deletes a note", async () => {
    expect((await noteRoute.DELETE(req("DELETE"), ctx())).status).toBe(204);
  });
});

describe("tags", () => {
  it("replaces tags, deduplicated", async () => {
    ads.getAd.mockResolvedValue({ id: AD });
    tags.setAdTags.mockResolvedValue(["UGC"]);
    const res = await tagsRoute.PUT(req("PUT", { tags: ["UGC", "ugc"] }), ctx(AD));
    expect(res.status).toBe(200);
    expect(tags.setAdTags).toHaveBeenCalledWith({}, AD, ["UGC"]);
  });

  it("404s for a missing ad", async () => {
    ads.getAd.mockResolvedValue(null);
    expect((await tagsRoute.PUT(req("PUT", { tags: [] }), ctx(AD))).status).toBe(404);
  });

  it("caps tag length", async () => {
    expect((await tagsRoute.PUT(req("PUT", { tags: ["x".repeat(41)] }), ctx(AD))).status).toBe(422);
  });
});
