import type { Metadata } from "next";
import { Suspense } from "react";
import { AdForm } from "@/components/ads/ad-form";
import { PageHeader } from "@/components/layout/page-header";
import { FormSkeleton } from "@/components/layout/states";
import { requireMemberPage } from "@/lib/auth";
import { distinctValues } from "@/lib/data/ads";

export const metadata: Metadata = { title: "Capture ad" };

export default function NewAdPage() {
  return (
    <>
      <PageHeader
        title="Capture an ad"
        description="Record an ad you found. Kuvah saves only what you enter or upload; it never fetches the link."
      />
      <Suspense fallback={<FormSkeleton />}>
        <NewAdForm />
      </Suspense>
    </>
  );
}

async function NewAdForm() {
  const { supabase } = await requireMemberPage();
  const [industries, angles] = await Promise.all([
    distinctValues(supabase, "industry"),
    distinctValues(supabase, "marketing_angle"),
  ]);
  return <AdForm mode="create" industries={industries} angles={angles} />;
}
