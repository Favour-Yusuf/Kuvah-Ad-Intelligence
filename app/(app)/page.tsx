import Link from "next/link";
import { Suspense } from "react";
import { CirclePlus } from "lucide-react";
import { AnalysisStatusBadge, PlatformBadge } from "@/components/ads/ad-badges";
import { BarList } from "@/components/dashboard/bar-list";
import { StatTile } from "@/components/dashboard/stat-tile";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMemberPage } from "@/lib/auth";
import { getDashboard } from "@/lib/data/dashboard";
import { teamNames } from "@/lib/data/team";
import { formatDate, formatDateTime } from "@/lib/format";
import { PLATFORM_LABELS, countryName } from "@/lib/validation/constants";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="The team's advertising research at a glance. Counts describe the library, not ad performance."
        actions={
          <Button nativeButton={false} render={<Link href="/ads/new" />}>
            <CirclePlus aria-hidden />
            Capture ad
          </Button>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}

async function DashboardContent() {
  const { supabase } = await requireMemberPage();
  const [{ summary, recent, collectionCount, activity }, names] = await Promise.all([getDashboard(supabase), teamNames(supabase)]);

  if (summary.total === 0) {
    return (
      <EmptyState
        title="No research yet"
        description="Capture the first ad you want the team to learn from. Metrics appear here as the library grows."
        action={<Button nativeButton={false} render={<Link href="/ads/new" />}>Capture an ad</Button>}
      />
    );
  }

  return (
    <>
      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile hero label="Saved ads" value={summary.total} />
        <StatTile
          label="Analysed"
          value={summary.analysed}
          hint={`${Math.round((summary.analysed / summary.total) * 100)}% of the library`}
        />
        <StatTile
          label="Awaiting analysis"
          value={summary.awaiting}
          hint={
            summary.awaiting ? (
              <>
                {summary.failed ? `Includes ${summary.failed} failed · ` : null}
                <Link href="/ads?status=none" className="underline-offset-4 hover:underline">
                  View unanalysed
                </Link>
              </>
            ) : (
              "All caught up"
            )
          }
        />
        <StatTile label="Collections" value={collectionCount} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ads by platform</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              caption="Saved ads by platform"
              items={summary.byPlatform.map((p) => ({ label: PLATFORM_LABELS[p.key], count: p.count, href: `/ads?platform=${p.key}` }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ads by target country</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              caption="Saved ads by target country"
              items={summary.byCountry.map((c) =>
                c.key === "Other"
                  ? { label: "Other", count: c.count }
                  : { label: countryName(c.key), count: c.count, href: `/ads?country=${c.key}` },
              )}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent captures</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {recent.map((ad) => (
                <li key={ad.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <PlatformBadge platform={ad.platform} />
                    <Link href={`/ads/${ad.id}`} className="truncate font-medium hover:underline">
                      {ad.brand}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <AnalysisStatusBadge status={ad.analysis_status} />
                    <span className="text-xs text-muted-foreground">{formatDate(ad.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Collection activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length ? (
              <ul className="flex flex-col divide-y">
                {activity.map((a) => (
                  <li key={`${a.collection_id}-${a.ad_id}`} className="py-2 text-sm">
                    <span className="text-muted-foreground">{(a.added_by && names.get(a.added_by)) || "Someone"} added </span>
                    <Link href={`/ads/${a.ad_id}`} className="font-medium hover:underline">{a.brand}</Link>
                    <span className="text-muted-foreground"> to </span>
                    <Link href={`/collections/${a.collection_id}`} className="font-medium hover:underline">{a.collection_name}</Link>
                    <span className="block text-xs text-muted-foreground">{formatDateTime(a.added_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No ads have been added to collections yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
