import type { AdFormat, AdPlatform, LibraryAnalysisStatus } from "@/lib/supabase/types";

export const PLATFORMS = ["facebook", "instagram", "tiktok", "google"] as const satisfies readonly AdPlatform[];
export const PLATFORM_LABELS: Record<AdPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  google: "Google",
};

export const FORMATS = ["image", "video", "carousel", "text", "other"] as const satisfies readonly AdFormat[];
export const FORMAT_LABELS: Record<AdFormat, string> = {
  image: "Image",
  video: "Video",
  carousel: "Carousel",
  text: "Text",
  other: "Other",
};

export const LIBRARY_STATUSES = ["none", "pending", "complete", "failed"] as const satisfies readonly LibraryAnalysisStatus[];
export const STATUS_LABELS: Record<LibraryAnalysisStatus, string> = {
  none: "Not analysed",
  pending: "Analysing",
  complete: "Analysed",
  failed: "Analysis failed",
};

/** Focus markets first, then other common ecommerce markets. Any ISO code is accepted. */
export const PRIORITY_COUNTRIES = ["US", "GB"] as const;
export const OTHER_COUNTRIES = [
  "AU", "CA", "IE", "NZ", "DE", "FR", "NL", "BE", "ES", "IT", "SE", "DK", "NO", "FI", "CH", "AT", "PL", "AE", "SG",
] as const;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(code: string) {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export const INDUSTRY_SUGGESTIONS = [
  "Beauty",
  "Skincare",
  "Health & wellness",
  "Apparel",
  "Accessories",
  "Home",
  "Food & drink",
  "Pets",
  "Fitness",
  "Electronics",
  "Baby & kids",
] as const;

export const PAGE_SIZE = 24;
