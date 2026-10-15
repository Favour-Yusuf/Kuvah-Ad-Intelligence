import Link from "next/link";
import { Button } from "@/components/ui/button";
import { filtersToSearchParams, type LibraryFilters } from "@/lib/validation/filters";

export function Pagination({ filters, page, pageCount }: { filters: LibraryFilters; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const qs = filtersToSearchParams({ ...filters, page: p }).toString();
    return qs ? `/ads?${qs}` : "/ads";
  };

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-3">
      {page > 1 ? (
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href(page - 1)} />}>
          Previous
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Previous
        </Button>
      )}
      <span className="text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href(page + 1)} />}>
          Next
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Next
        </Button>
      )}
    </nav>
  );
}
