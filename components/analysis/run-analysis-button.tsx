"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client-api";

export function RunAnalysisButton({ adId, hasRun }: { adId: string; hasRun: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const result = await apiFetch<{ analysis: { status: string; error: string | null } }>(`/api/ads/${adId}/analyses`, {
      method: "POST",
    });
    setRunning(false);
    if (result.ok) {
      toast.success("Analysis complete.");
    } else {
      toast.error(result.error);
    }
    router.refresh();
  }

  const Icon = hasRun ? RefreshCw : Sparkles;
  return (
    <Button onClick={run} disabled={running} size="sm" aria-live="polite">
      <Icon className={running ? "animate-spin" : undefined} aria-hidden />
      {running ? "Analysing… (up to a minute)" : hasRun ? "Re-run analysis" : "Run AI analysis"}
    </Button>
  );
}
