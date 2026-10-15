import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AnalysisStatusBadge } from "@/components/ads/ad-badges";
import { SourceLink } from "@/components/ads/source-link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, GridSkeleton } from "@/components/layout/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireMemberPage } from "@/lib/auth";
import { buildCompareRows } from "@/lib/compare";
import { getAdsByIds } from "@/lib/data/ads";
import { latestCompleteByAd } from "@/lib/data/analyses";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseCompareIds } from "@/lib/validation/organise";

export const metadata: Metadata = { title: "Compare ads" };

export default function ComparePage({ searchParams }: PageProps<"/compare">) {
  return (
    <>
      <PageHeader
        title="Compare ads"
        description="Captured facts and AI interpretations side by side. Highlighted rows differ between ads."
      />
      <Suspense fallback={<GridSkeleton count={3} />}>
        <Comparison searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Comparison({ searchParams }: { searchParams: PageProps<"/compare">["searchParams"] }) {
  const parsed = parseCompareIds((await searchParams).ids);
  if (!parsed.success) {
    return (
      <EmptyState
        title="Choose ads to compare"
        description="Select two to four ads in the library or a collection, then choose Compare."
        action={<Button nativeButton={false} render={<Link href="/ads" />}>Open the library</Button>}
      />
    );
  }

  const { supabase } = await requireMemberPage();
  const ads = await getAdsByIds(supabase, parsed.data);
  if (ads.length < 2) {
    return <EmptyState title="Some of these ads no longer exist" description="Go back to the library and choose again." />;
  }
  const analyses = await latestCompleteByAd(supabase, ads.map((a) => a.id));
  const rows = buildCompareRows(ads, analyses);
  const missing = ads.filter((a) => !analyses.has(a.id));

  return (
    <>
      {missing.length ? (
        <p className="text-sm text-muted-foreground">
          {missing.map((a) => a.brand).join(", ")} {missing.length === 1 ? "has" : "have"} no completed analysis, so interpretation rows
          show “Not analysed”. Run an analysis from the ad&apos;s page.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">Comparison of {ads.length} ads</caption>
          <thead>
            <tr className="border-b bg-muted/40 align-top">
              <th scope="col" className="w-40 p-3 text-left font-medium">
                <span className="sr-only">Attribute</span>
              </th>
              {ads.map((ad) => (
                <th key={ad.id} scope="col" className="p-3 text-left font-normal">
                  <Link href={`/ads/${ad.id}`} className="font-medium hover:underline">
                    {ad.brand}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <AnalysisStatusBadge status={ad.analysis_status} />
                    <span className="text-xs text-muted-foreground">Observed {formatDate(ad.observed_at)}</span>
                  </div>
                  <SourceLink url={ad.source_url} className="mt-1 text-xs" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.key}
                className={cn(
                  "border-b align-top last:border-0",
                  row.differs && "bg-amber-50/60 dark:bg-amber-950/20",
                  i > 0 && row.source !== rows[i - 1].source && "border-t-4",
                )}
              >
                <th scope="row" className="p-3 text-left font-medium">
                  <div className="flex flex-col gap-1">
                    {row.label}
                    <Badge variant="outline" className="w-fit font-normal">
                      {row.source === "observed" ? "Observed" : "Interpretation"}
                    </Badge>
                    {row.differs ? <span className="sr-only">(values differ)</span> : null}
                  </div>
                </th>
                {row.cells.map((cell, j) => (
                  <td key={ads[j].id} className="p-3">
                    {cell.text ? (
                      <span className={cell.withheld ? "text-muted-foreground italic" : undefined}>{cell.text}</span>
                    ) : (
                      <span className="text-muted-foreground">{row.source === "interpretation" ? "Not analysed" : "—"}</span>
                    )}
                    {cell.quote ? <blockquote className="mt-1 border-l-2 pl-2 text-xs text-muted-foreground">“{cell.quote}”</blockquote> : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
