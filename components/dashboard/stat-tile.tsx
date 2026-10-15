import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A headline number. `hero` is reserved for the one figure the dashboard leads with. */
export function StatTile({ label, value, hint, hero }: { label: string; value: number; hint?: ReactNode; hero?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tracking-tight", hero ? "text-5xl" : "text-3xl")}>{value.toLocaleString("en-GB")}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
