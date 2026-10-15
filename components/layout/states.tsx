import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-4" aria-busy aria-label="Loading">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2" aria-busy aria-label="Loading">
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-48 w-full" />
      ))}
    </div>
  );
}
