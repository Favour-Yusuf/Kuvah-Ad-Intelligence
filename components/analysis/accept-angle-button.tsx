"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client-api";

/** Copies the AI's suggested angle onto the ad, where it becomes a person-confirmed, filterable value. */
export function AcceptAngleButton({ adId, label }: { adId: string; label: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function accept() {
    setSaving(true);
    const result = await apiFetch(`/api/ads/${adId}`, { method: "PATCH", body: { marketing_angle: label } });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Marketing angle set to “${label}”.`);
    router.refresh();
  }

  return (
    <Button variant="outline" size="xs" onClick={accept} disabled={saving}>
      <Check aria-hidden />
      Use “{label}” as this ad&apos;s angle
    </Button>
  );
}
