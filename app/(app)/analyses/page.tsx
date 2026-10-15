import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, GridSkeleton } from "@/components/layout/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireMemberPage } from "@/lib/auth";
import { listRecentAnalyses } from "@/lib/data/analyses";
import { teamNames } from "@/lib/data/team";
import { formatDateTime, truncate } from "@/lib/format";
import type { AnalysisStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Analyses" };

const PAGE_SIZE = 25;
const STATUSES: { value: AnalysisStatus | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "complete", label: "Complete" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Running" },
];

export default function AnalysesPage({ searchParams }: PageProps<"/analyses">) {
  return (
    <>
      <PageHeader title="Analyses" description="Every AI analysis the team has run, newest first." />
      <Suspense fallback={<GridSkeleton count={3} />}>
        <AnalysesList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AnalysesList({ searchParams }: { searchParams: PageProps<"/analyses">["searchParams"] }) {
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = STATUSES.find((s) => s.value === rawStatus)?.value ?? null;
  const pageRaw = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const { supabase } = await requireMemberPage();
  const [{ rows, total }, names] = await Promise.all([
    listRecentAnalyses(supabase, { status, page, pageSize: PAGE_SIZE }),
    teamNames(supabase),
  ]);
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const href = (s: AnalysisStatus | null, p = 1) => {
    const q = new URLSearchParams();
    if (s) q.set("status", s);
    if (p > 1) q.set("page", String(p));
    return q.size ? `/analyses?${q}` : "/analyses";
  };

  return (
    <>
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Button
            key={s.label}
            size="sm"
            variant={s.value === status ? "default" : "outline"}
            nativeButton={false}
            render={<Link href={href(s.value)} aria-current={s.value === status ? "page" : undefined} />}
          >
            {s.label}
          </Button>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          title={status ? "No analyses with this status" : "No analyses yet"}
          description="Open an ad and choose “Run AI analysis”."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Run by</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/ads/${r.ad_id}`} className="font-medium hover:underline">
                      {r.ads?.brand ?? "Deleted ad"}
                    </Link>
                    {r.ads?.headline ? <span className="block text-xs text-muted-foreground">{truncate(r.ads.headline, 60)}</span> : null}
                    {r.status === "failed" && r.error ? <span className="block text-xs text-destructive">{r.error}</span> : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "failed" ? "destructive" : r.status === "complete" ? "default" : "secondary"}>
                      {STATUSES.find((s) => s.value === r.status)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>{(r.created_by && names.get(r.created_by)) || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.provider === "fake" ? "offline" : r.model}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-3 text-sm">
          {page > 1 ? <Link href={href(status, page - 1)} className="underline-offset-4 hover:underline">Previous</Link> : null}
          <span className="text-muted-foreground">Page {page} of {pageCount}</span>
          {page < pageCount ? <Link href={href(status, page + 1)} className="underline-offset-4 hover:underline">Next</Link> : null}
        </nav>
      ) : null}
    </>
  );
}
