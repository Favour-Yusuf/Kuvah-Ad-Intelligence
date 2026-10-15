import { describe, expect, it } from "vitest";
import { summarise, type DashboardRow } from "@/lib/dashboard";

const row = (platform: DashboardRow["platform"], target_country: string, analysis_status: DashboardRow["analysis_status"]): DashboardRow => ({
  platform,
  target_country,
  analysis_status,
});

describe("summarise", () => {
  it("counts totals and analysis states", () => {
    const s = summarise([
      row("tiktok", "US", "complete"),
      row("tiktok", "GB", "none"),
      row("google", "US", "failed"),
      row("facebook", "US", "pending"),
    ]);
    expect(s).toMatchObject({ total: 4, analysed: 1, awaiting: 2, failed: 1 });
  });

  it("keeps every platform in a fixed order, including zeros", () => {
    const s = summarise([row("google", "US", "none")]);
    expect(s.byPlatform).toEqual([
      { key: "facebook", count: 0 },
      { key: "instagram", count: 0 },
      { key: "tiktok", count: 0 },
      { key: "google", count: 1 },
    ]);
  });

  it("ranks countries and folds the tail into Other", () => {
    const rows = [
      ...Array.from({ length: 3 }, () => row("tiktok", "US", "none")),
      ...Array.from({ length: 2 }, () => row("tiktok", "GB", "none")),
      row("tiktok", "DE", "none"),
      row("tiktok", "FR", "none"),
    ];
    expect(summarise(rows, 2).byCountry).toEqual([
      { key: "US", count: 3 },
      { key: "GB", count: 2 },
      { key: "Other", count: 2 },
    ]);
  });

  it("handles an empty library", () => {
    expect(summarise([])).toMatchObject({ total: 0, analysed: 0, awaiting: 0, byCountry: [] });
  });
});
