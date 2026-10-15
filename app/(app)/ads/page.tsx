import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CirclePlus } from "lucide-react";
import { AdCard } from "@/components/ads/ad-card";
import { LibraryFilters } from "@/components/ads/library-filters";
import { Pagination } from "@/components/ads/pagination";
import { SelectableAdGrid } from "@/components/ads/selectable-ad-grid";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, GridSkeleton } from "@/components/layout/states";
import { Button } from "@/components/ui/button";
import { requireMemberPage } from "@/lib/auth";
import { distinctValues, listAds } from "@/lib/data/ads";
import { listTagNames } from "@/lib/data/tags";
import { listCollectionOptions } from "@/lib/data/collections";
import { activeFilterCount, parseLibraryFilters } from "@/lib/validation/filters";

export const metadata: Metadata = { title: "Ad library" };

export default function LibraryPage({ searchParams }: PageProps<"/ads">) {
  return (
    <>
      <PageHeader
        title="Ad library"
        description="Every ad the team has captured. Filters are kept in the URL, so you can share a view."
        actions={
          <Button nativeButton={false} render={<Link href="/ads/new" />}>
            <CirclePlus aria-hidden />
            Capture ad
          </Button>
        }
      />
      <Suspense fallback={<GridSkeleton />}>
        <Library searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Library({ searchParams }: { searchParams: PageProps<"/ads">["searchParams"] }) {
  const filters = parseLibraryFilters(await searchParams);
  const { supabase } = await requireMemberPage();
  const [result, industries, angles, tags, collections] = await Promise.all([
    listAds(supabase, filters),
    distinctValues(supabase, "industry"),
    distinctValues(supabase, "marketing_angle"),
    listTagNames(supabase),
    listCollectionOptions(supabase),
  ]);
  const filtered = activeFilterCount(filters) > 0;

  return (
    <>
      {/* key resets the search box when the URL changes from elsewhere (e.g. chips, back button). */}
      <LibraryFilters key={filters.q ?? ""} filters={filters} industries={industries} angles={angles} tags={tags} />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {result.total === 1 ? "1 ad" : `${result.total.toLocaleString("en-GB")} ads`}
        {filtered ? " match these filters" : ""}
      </p>

      {result.rows.length === 0 ? (
        filtered ? (
          <EmptyState title="No ads match these filters" description="Remove a filter or try a broader search." />
        ) : (
          <EmptyState
            title="The library is empty"
            description="Capture the first ad you want the team to learn from."
            action={<Button nativeButton={false} render={<Link href="/ads/new" />}>Capture an ad</Button>}
          />
        )
      ) : (
        <SelectableAdGrid
          collections={collections}
          items={result.rows.map((ad) => ({ id: ad.id, brand: ad.brand, card: <AdCard ad={ad} /> }))}
        />
      )}

      <Pagination filters={filters} page={result.page} pageCount={result.pageCount} />
    </>
  );
}
