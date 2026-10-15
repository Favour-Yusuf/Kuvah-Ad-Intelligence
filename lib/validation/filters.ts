import { z } from "zod";
import type { AdFormat, AdPlatform, LibraryAnalysisStatus } from "@/lib/supabase/types";
import { FORMATS, LIBRARY_STATUSES, PLATFORMS } from "./constants";
import { cleanText } from "./text";

export type LibraryFilters = {
  q: string | null;
  platforms: AdPlatform[];
  countries: string[];
  formats: AdFormat[];
  industry: string | null;
  angle: string | null;
  status: LibraryAnalysisStatus | null;
  tag: string | null;
  sort: "observed" | "captured";
  page: number;
};

export const EMPTY_FILTERS: LibraryFilters = {
  q: null,
  platforms: [],
  countries: [],
  formats: [],
  industry: null,
  angle: null,
  status: null,
  tag: null,
  sort: "observed",
  page: 1,
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Comma-separated lists, filtered to allowed values, deduplicated. */
function list<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T[] {
  const raw = (Array.isArray(value) ? value.join(",") : (value ?? "")).split(",");
  const set = new Set(allowed as readonly string[]);
  return [...new Set(raw.map((v) => v.trim().toLowerCase()).filter((v) => set.has(v)))] as T[];
}

function text(value: string | string[] | undefined, max: number) {
  const v = first(value);
  if (!v) return null;
  const cleaned = cleanText(v).slice(0, max);
  return cleaned || null;
}

/**
 * Parses library search params leniently: invalid values are dropped rather
 * than rejected, so a hand-edited URL still shows a sensible library.
 */
export function parseLibraryFilters(params: RawParams): LibraryFilters {
  const countries = [
    ...new Set(
      (first(params.country) ?? "")
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter((c) => /^[A-Z]{2}$/.test(c)),
    ),
  ];
  const status = first(params.status);
  const page = z.coerce.number().int().min(1).max(10_000).safeParse(first(params.page));

  return {
    q: text(params.q, 200),
    platforms: list(params.platform, PLATFORMS),
    countries,
    formats: list(params.format, FORMATS),
    industry: text(params.industry, 80),
    angle: text(params.angle, 120),
    status: (LIBRARY_STATUSES as readonly string[]).includes(status ?? "") ? (status as LibraryAnalysisStatus) : null,
    tag: text(params.tag, 40),
    sort: first(params.sort) === "captured" ? "captured" : "observed",
    page: page.success ? page.data : 1,
  };
}

/** Inverse of parseLibraryFilters. Omits defaults so URLs stay short. */
export function filtersToSearchParams(filters: Partial<LibraryFilters>) {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.platforms?.length) p.set("platform", filters.platforms.join(","));
  if (filters.countries?.length) p.set("country", filters.countries.join(","));
  if (filters.formats?.length) p.set("format", filters.formats.join(","));
  if (filters.industry) p.set("industry", filters.industry);
  if (filters.angle) p.set("angle", filters.angle);
  if (filters.status) p.set("status", filters.status);
  if (filters.tag) p.set("tag", filters.tag);
  if (filters.sort === "captured") p.set("sort", "captured");
  if (filters.page && filters.page > 1) p.set("page", String(filters.page));
  return p;
}

export function activeFilterCount(filters: LibraryFilters) {
  return (
    (filters.q ? 1 : 0) +
    filters.platforms.length +
    filters.countries.length +
    filters.formats.length +
    (filters.industry ? 1 : 0) +
    (filters.angle ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.tag ? 1 : 0)
  );
}
