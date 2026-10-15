import { Badge } from "@/components/ui/badge";
import type { AdFormat, AdPlatform, LibraryAnalysisStatus } from "@/lib/supabase/types";
import { FORMAT_LABELS, PLATFORM_LABELS, STATUS_LABELS, countryName } from "@/lib/validation/constants";

export function PlatformBadge({ platform }: { platform: AdPlatform }) {
  return <Badge variant="secondary">{PLATFORM_LABELS[platform]}</Badge>;
}

export function CountryBadge({ code }: { code: string }) {
  return (
    <Badge variant="outline" title={countryName(code)}>
      {code}
    </Badge>
  );
}

export function FormatBadge({ format }: { format: AdFormat }) {
  return <Badge variant="outline">{FORMAT_LABELS[format]}</Badge>;
}

const statusVariant: Record<LibraryAnalysisStatus, "default" | "secondary" | "outline" | "destructive"> = {
  none: "outline",
  pending: "secondary",
  complete: "default",
  failed: "destructive",
};

export function AnalysisStatusBadge({ status }: { status: LibraryAnalysisStatus }) {
  return <Badge variant={statusVariant[status]}>{STATUS_LABELS[status]}</Badge>;
}
