import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Pencil } from "lucide-react";
import { AnalysisStatusBadge, CountryBadge, FormatBadge, PlatformBadge } from "@/components/ads/ad-badges";
import { DeleteAdButton } from "@/components/ads/delete-ad-button";
import { ObservedPane } from "@/components/ads/observed-pane";
import { AnalysisPanel } from "@/components/analysis/analysis-panel";
import { DetailSkeleton } from "@/components/layout/states";
import { Button } from "@/components/ui/button";
import { parseId } from "@/lib/api";
import { requireMemberPage } from "@/lib/auth";
import { getAd } from "@/lib/data/ads";
import { listAnalysesForAd } from "@/lib/data/analyses";
import { signedCreativeUrl } from "@/lib/data/creatives";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Ad" };

export default function AdPage({ params }: PageProps<"/ads/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <AdDetail params={params} />
    </Suspense>
  );
}

async function AdDetail({ params }: { params: PageProps<"/ads/[id]">["params"] }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const { supabase, member } = await requireMemberPage();
  const ad = await getAd(supabase, id);
  if (!ad) notFound();
  const [creativeUrl, analyses] = await Promise.all([
    signedCreativeUrl(supabase, ad.creative_path),
    listAnalysesForAd(supabase, ad.id),
  ]);
  const canDelete = ad.created_by === member.id || member.role === "admin";

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{ad.brand}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <PlatformBadge platform={ad.platform} />
            <CountryBadge code={ad.target_country} />
            <FormatBadge format={ad.format} />
            <AnalysisStatusBadge status={ad.analysis_status} />
            <span className="text-xs text-muted-foreground">Observed {formatDate(ad.observed_at)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/ads/${ad.id}/edit`} />}>
            <Pencil aria-hidden />
            Edit
          </Button>
          {canDelete ? <DeleteAdButton adId={ad.id} brand={ad.brand} /> : null}
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ObservedPane ad={ad} creativeUrl={creativeUrl} />
        <AnalysisPanel ad={ad} analyses={analyses} />
      </div>
    </>
  );
}
