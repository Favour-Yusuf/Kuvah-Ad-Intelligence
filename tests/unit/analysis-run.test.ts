import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdLibraryRow } from "@/lib/supabase/types";

const MEMBER = { id: "11111111-1111-4111-8111-111111111111", email: null, displayName: "M", role: "member" as const };
const AD_ID = "22222222-2222-4222-8222-222222222222";

const auth = vi.hoisted(() => ({ requireMemberApi: vi.fn() }));
const ads = vi.hoisted(() => ({ getAd: vi.fn() }));
const analyses = vi.hoisted(() => ({
  countRecentRuns: vi.fn(),
  startAnalysis: vi.fn(),
  finishAnalysis: vi.fn(),
}));
const creatives = vi.hoisted(() => ({ downloadImageCreative: vi.fn() }));
const analyzerMod = vi.hoisted(() => ({ getAnalyzer: vi.fn() }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/data/ads", () => ads);
vi.mock("@/lib/data/analyses", () => analyses);
vi.mock("@/lib/data/creatives", () => creatives);
vi.mock("@/lib/analysis", () => analyzerMod);
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ admin: true }) }));

const { POST } = await import("@/app/api/ads/[id]/analyses/route");
const { createFakeAnalyzer } = await import("@/lib/analysis/providers/fake");
const { AnalyzerError } = await import("@/lib/analysis/analyzer");

const ad = {
  id: AD_ID,
  brand: "Lumen",
  platform: "tiktok",
  target_country: "GB",
  format: "video",
  headline: "Your routine, simplified",
  ad_copy: "Stop guessing.",
  creative_description: null,
  cta: "Shop now",
  creative_path: null,
} as unknown as AdLibraryRow;

const ORIGIN = "http://localhost:3000";
const req = () => new NextRequest(`${ORIGIN}/api/ads/${AD_ID}/analyses`, { method: "POST", headers: { origin: ORIGIN } });
const ctx = { params: Promise.resolve({ id: AD_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireMemberApi.mockResolvedValue({ ok: true, supabase: { user: true }, member: MEMBER });
  ads.getAd.mockResolvedValue(ad);
  analyses.countRecentRuns.mockResolvedValue(0);
  analyses.startAnalysis.mockResolvedValue({ id: "run-1" });
  analyses.finishAnalysis.mockImplementation(async (_admin, id, outcome) => ({ id, ...outcome }));
  creatives.downloadImageCreative.mockResolvedValue(null);
  analyzerMod.getAnalyzer.mockReturnValue(createFakeAnalyzer());
});

describe("POST /api/ads/[id]/analyses", () => {
  it("runs, applies guardrails and stores the result with the admin client", async () => {
    const res = await POST(req(), ctx);
    expect(res.status).toBe(201);

    expect(analyses.startAnalysis).toHaveBeenCalledWith(
      { user: true },
      expect.objectContaining({ ad_id: AD_ID, provider: "fake", input_hash: expect.stringMatching(/^[0-9a-f]{64}$/) }),
    );
    const [admin, id, outcome] = analyses.finishAnalysis.mock.calls[0];
    expect(admin).toEqual({ admin: true });
    expect(id).toBe("run-1");
    expect(outcome.status).toBe("complete");
    expect(outcome.result.basis).toBe("interpretation");
    expect(outcome.result.fields.opening_hook.supporting_quote).toBe("Your routine, simplified");
  });

  it("records a readable failure when the analyzer refuses", async () => {
    analyzerMod.getAnalyzer.mockReturnValue({
      provider: "fake",
      model: "m",
      analyze: async () => {
        throw new AnalyzerError("refused", "The AI declined to analyse this ad.");
      },
    });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(502);
    expect(analyses.finishAnalysis.mock.calls[0][2]).toEqual({ status: "failed", error: "The AI declined to analyse this ad." });
  });

  it("records a failure when the output breaks the schema", async () => {
    analyzerMod.getAnalyzer.mockReturnValue(createFakeAnalyzer(() => ({ nonsense: true })));
    const res = await POST(req(), ctx);
    expect(res.status).toBe(502);
    expect(analyses.finishAnalysis.mock.calls[0][2].error).toMatch(/unexpected format/);
  });

  it("never sends the source URL and only sends uploaded images", async () => {
    const analyze = vi.fn(createFakeAnalyzer().analyze);
    analyzerMod.getAnalyzer.mockReturnValue({ provider: "fake", model: "m", analyze });
    ads.getAd.mockResolvedValue({ ...ad, source_url: "https://example.com/secret", creative_path: "ads/x/y.png" });
    creatives.downloadImageCreative.mockResolvedValue({ mediaType: "image/png", base64: "AAAA" });

    await POST(req(), ctx);
    const input = analyze.mock.calls[0][0];
    expect(JSON.stringify(input)).not.toContain("example.com");
    expect(input.image).toEqual({ mediaType: "image/png", base64: "AAAA" });
  });

  it("rate limits each member", async () => {
    analyses.countRecentRuns.mockResolvedValue(5);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(analyses.startAnalysis).not.toHaveBeenCalled();
  });

  it("refuses ads with nothing to analyse", async () => {
    ads.getAd.mockResolvedValue({ ...ad, headline: null, ad_copy: null, creative_description: null });
    expect((await POST(req(), ctx)).status).toBe(422);
  });

  it("rejects non-members before doing any work", async () => {
    auth.requireMemberApi.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) });
    expect((await POST(req(), ctx)).status).toBe(403);
    expect(analyses.countRecentRuns).not.toHaveBeenCalled();
  });
});
