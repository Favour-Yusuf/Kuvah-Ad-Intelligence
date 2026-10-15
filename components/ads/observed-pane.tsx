import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SourceLink } from "@/components/ads/source-link";
import { formatDate } from "@/lib/format";
import type { AdLibraryRow } from "@/lib/supabase/types";
import { FORMAT_LABELS, PLATFORM_LABELS, countryName } from "@/lib/validation/constants";

/** Exactly what a team member captured. Nothing here is AI-generated. */
export function ObservedPane({ ad, creativeUrl }: { ad: AdLibraryRow; creativeUrl: string | null }) {
  const isVideo = ad.creative_path?.endsWith(".mp4");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Observed</CardTitle>
          <Badge variant="outline">Captured by the team</Badge>
        </div>
        <CardDescription>Recorded from the source, as seen. Not AI-generated.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {creativeUrl ? (
          isVideo ? (
            <video src={creativeUrl} controls preload="metadata" className="max-h-96 w-full rounded-md bg-muted" />
          ) : (
            // Signed, short-lived URL to a private bucket; next/image cannot cache it usefully.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creativeUrl} alt={`Creative captured for ${ad.brand}`} className="max-h-96 w-full rounded-md bg-muted object-contain" />
          )
        ) : null}

        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Fact label="Source"><SourceLink url={ad.source_url} /></Fact>
          <Fact label="Date observed">{formatDate(ad.observed_at)}</Fact>
          <Fact label="Platform">{PLATFORM_LABELS[ad.platform]}</Fact>
          <Fact label="Target country">{countryName(ad.target_country)} ({ad.target_country})</Fact>
          <Fact label="Format">{FORMAT_LABELS[ad.format]}</Fact>
          <Fact label="Industry">{ad.industry ?? "—"}</Fact>
          <Fact label="Call to action">{ad.cta ?? "—"}</Fact>
          <Fact label="Marketing angle">{ad.marketing_angle ?? "—"}</Fact>
        </dl>

        <TextBlock label="Headline" value={ad.headline} />
        <TextBlock label="Ad copy" value={ad.ad_copy} />
        <TextBlock label="Creative description" value={ad.creative_description} />
        <TextBlock label="Research notes" value={ad.research_notes} />
      </CardContent>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <h3 className="text-xs text-muted-foreground">{label}</h3>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}
