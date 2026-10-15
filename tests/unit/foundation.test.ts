import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "@/lib/env";
import { isPublicPath } from "@/lib/supabase/proxy";
import { isActiveLink } from "@/components/layout/nav-links";

describe("parsePublicEnv", () => {
  const valid = {
    NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  };

  it("accepts valid values and defaults the site URL", () => {
    expect(parsePublicEnv(valid).NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("rejects a missing key and names it", () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined })).toThrow(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it("rejects a malformed URL", () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow(/SUPABASE_URL/);
  });
});

describe("parseServerEnv", () => {
  it("requires an Anthropic key when the Anthropic provider is selected", () => {
    expect(() => parseServerEnv({ SUPABASE_SECRET_KEY: "s", ANALYSIS_PROVIDER: "anthropic" })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });

  it("allows the fake provider without an Anthropic key", () => {
    const env = parseServerEnv({ SUPABASE_SECRET_KEY: "s", ANALYSIS_PROVIDER: "fake" });
    expect(env.ANALYSIS_PROVIDER).toBe("fake");
    expect(env.ANTHROPIC_MODEL).toBe("claude-sonnet-5-5");
  });

  it("rejects an unknown provider", () => {
    expect(() => parseServerEnv({ SUPABASE_SECRET_KEY: "s", ANALYSIS_PROVIDER: "other" })).toThrow();
  });
});

describe("isPublicPath", () => {
  it.each([
    ["/login", true],
    ["/auth/callback", true],
    ["/", false],
    ["/ads", false],
    ["/loginx", false],
  ])("%s -> %s", (path, expected) => {
    expect(isPublicPath(path)).toBe(expected);
  });
});

describe("isActiveLink", () => {
  it("keeps the capture form separate from the library", () => {
    expect(isActiveLink("/ads/new", "/ads/new")).toBe(true);
    expect(isActiveLink("/ads/new", "/ads")).toBe(false);
  });

  it("treats ad detail pages as part of the library", () => {
    expect(isActiveLink("/ads/123", "/ads")).toBe(true);
  });

  it("only highlights the dashboard on the root path", () => {
    expect(isActiveLink("/", "/")).toBe(true);
    expect(isActiveLink("/collections", "/")).toBe(false);
  });
});
