"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
      <div className="flex items-center gap-2 font-medium">
        <TriangleAlert className="size-4 text-destructive" aria-hidden />
        This page could not be loaded.
      </div>
      <p className="text-sm text-muted-foreground">
        {error.digest ? `Something went wrong on our side (reference ${error.digest}).` : "Something went wrong."} Try again.
      </p>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
