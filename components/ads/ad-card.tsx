import Link from "next/link";
import { AnalysisStatusBadge, CountryBadge, FormatBadge, PlatformBadge } from "@/components/ads/ad-badges";
import { SourceLink } from "@/components/ads/source-link";
import { formatDate, truncate } from "@/lib/format";
import type { AdLibraryRow } from "@/lib/supabase/types";

/** Compact research card. The whole title links to the detail page; the source link stays separate. */
export function AdCard({ ad, selectControl }: { ad: AdLibraryRow; selectControl?: React.ReactNode }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4 transition-colors has-[a.ad-title:hover]:border-foreground/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <PlatformBadge platform={ad.platform} />
          <CountryBadge code={ad.target_country} />
          <FormatBadge format={ad.format} />
        </div>
        {selectControl}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-sm font-medium">
          <Link href={`/ads/${ad.id}`} className="ad-title hover:underline">
            {ad.brand}
            {ad.headline ? <span className="block font-normal text-foreground/90">{truncate(ad.headline, 90)}</span> : null}
          </Link>
        </h2>
        {ad.ad_copy ? <p className="line-clamp-2 text-sm text-muted-foreground">{ad.ad_copy}</p> : null}
        {!ad.ad_copy && ad.creative_description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground italic">{ad.creative_description}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {ad.cta ? <span className="rounded border px-1.5 py-0.5">{ad.cta}</span> : null}
        {ad.marketing_angle ? <span className="text-muted-foreground">Angle: {ad.marketing_angle}</span> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <AnalysisStatusBadge status={ad.analysis_status} />
        <span className="text-xs text-muted-foreground">Observed {formatDate(ad.observed_at)}</span>
      </div>
      <SourceLink url={ad.source_url} className="text-xs" />
    </article>
  );
}
