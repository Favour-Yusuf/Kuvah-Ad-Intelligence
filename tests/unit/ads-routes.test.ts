import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const MEMBER = { id: "11111111-1111-4111-8111-111111111111", email: "m@x.test", displayName: "M", role: "member" as const };
const AD_ID = "22222222-2222-4222-8222-222222222222";

const auth = vi.hoisted(() => ({ requireMemberApi: vi.fn() }));
const data = vi.hoisted(() => ({
  createAd: vi.fn(),
  getAd: vi.fn(),
  updateAd: vi.fn(),
  deleteAd: vi.fn(),
}));
const creatives = vi.hoisted(() => ({ removeCreative: vi.fn() }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/data/ads", () => data);
vi.mock("@/lib/data/creatives", () => creatives);

const { POST } = await import("@/app/api/ads/route");
const { PATCH, DELETE } = await import("@/app/api/ads/[id]/route");
const { DataError } = await import("@/lib/data/client");

const ORIGIN = "http://localhost:3000";
function req(method: string, path: string, body?: unknown, origin = ORIGIN) {
  return new NextRequest(`${ORIGIN}${path}`, {
    method,
    headers: { "content-type": "application/json", origin },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const validAd = {
  source_url: "https://example.com/ad",
  brand: "Lumen",
  platform: "tiktok",
  target_country: "GB",
  format: "video",
  headline: "Hook",
  observed_at: "2026-10-01",
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireMemberApi.mockResolvedValue({ ok: true, supabase: {}, member: MEMBER });
});

describe("POST /api/ads", () => {
  it("creates an ad from valid input", async () => {
    data.createAd.mockResolvedValue({ id: AD_ID });
    const res = await POST(req("POST", "/api/ads", validAd));
    expect(res.status).toBe(201);
    expect(data.createAd).toHaveBeenCalledWith({}, expect.objectContaining({ brand: "Lumen", target_country: "GB" }), "manual");
  });

  it("returns field errors for invalid input", async () => {
    const res = await POST(req("POST", "/api/ads", { ...validAd, source_url: "http://insecure.test" }));
    expect(res.status).toBe(422);
    expect((await res.json()).fields.source_url).toMatch(/https/);
    expect(data.createAd).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const bad = new NextRequest(`${ORIGIN}/api/ads`, { method: "POST", headers: { origin: ORIGIN }, body: "{nope" });
    expect((await POST(bad)).status).toBe(400);
  });

  it("blocks cross-site requests", async () => {
    const res = await POST(req("POST", "/api/ads", validAd, "https://evil.test"));
    expect(res.status).toBe(403);
    expect(auth.requireMemberApi).not.toHaveBeenCalled();
  });

  it("passes through auth failures", async () => {
    auth.requireMemberApi.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Not signed in." }, { status: 401 }) });
    expect((await POST(req("POST", "/api/ads", validAd))).status).toBe(401);
  });
});

describe("PATCH /api/ads/[id]", () => {
  it("404s on a malformed id without touching the database", async () => {
    const res = await PATCH(req("PATCH", "/api/ads/abc", { brand: "x" }), ctx("abc"));
    expect(res.status).toBe(404);
    expect(auth.requireMemberApi).not.toHaveBeenCalled();
  });

  it("refuses an edit that leaves nothing to research", async () => {
    data.getAd.mockResolvedValue({ id: AD_ID, headline: "Hook", ad_copy: null, creative_description: null, creative_path: null });
    const res = await PATCH(req("PATCH", `/api/ads/${AD_ID}`, { headline: "" }), ctx(AD_ID));
    expect(res.status).toBe(422);
    expect(data.updateAd).not.toHaveBeenCalled();
  });

  it("removes the old creative when it is replaced", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    data.getAd.mockResolvedValue({ id: AD_ID, headline: "Hook", creative_path: `ads/${id}/${id}.png` });
    data.updateAd.mockResolvedValue({ id: AD_ID, creative_path: null });
    const res = await PATCH(req("PATCH", `/api/ads/${AD_ID}`, { creative_path: null }), ctx(AD_ID));
    expect(res.status).toBe(200);
    expect(creatives.removeCreative).toHaveBeenCalledWith({}, `ads/${id}/${id}.png`);
  });

  it("404s when the ad does not exist", async () => {
    data.getAd.mockResolvedValue(null);
    expect((await PATCH(req("PATCH", `/api/ads/${AD_ID}`, { brand: "x" }), ctx(AD_ID))).status).toBe(404);
  });
});

describe("DELETE /api/ads/[id]", () => {
  it("deletes and cleans up the creative", async () => {
    data.deleteAd.mockResolvedValue({ creativePath: "ads/a/b.png" });
    const res = await DELETE(req("DELETE", `/api/ads/${AD_ID}`), ctx(AD_ID));
    expect(res.status).toBe(204);
    expect(creatives.removeCreative).toHaveBeenCalledWith({}, "ads/a/b.png");
  });

  it("reports when the member may not delete", async () => {
    data.deleteAd.mockRejectedValue(new DataError("Only the person who captured this ad, or an admin, can delete it.", 403));
    const res = await DELETE(req("DELETE", `/api/ads/${AD_ID}`), ctx(AD_ID));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/admin/);
  });
});
