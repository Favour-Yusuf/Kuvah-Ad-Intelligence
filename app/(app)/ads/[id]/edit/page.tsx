import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdForm } from "@/components/ads/ad-form";
import { PageHeader } from "@/components/layout/page-header";
import { FormSkeleton } from "@/components/layout/states";
import { parseId } from "@/lib/api";
import { requireMemberPage } from "@/lib/auth";
import { distinctValues, getAd } from "@/lib/data/ads";
import { signedCreativeUrl } from "@/lib/data/creatives";

export const metadata: Metadata = { title: "Edit ad" };

export default function EditAdPage({ params }: PageProps<"/ads/[id]/edit">) {
  return (
    <>
      <PageHeader title="Edit ad" description="Changes are visible to the whole team." />
      <Suspense fallback={<FormSkeleton />}>
        <EditForm params={params} />
      </Suspense>
    </>
  );
}

async function EditForm({ params }: { params: PageProps<"/ads/[id]/edit">["params"] }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const { supabase } = await requireMemberPage();
  const ad = await getAd(supabase, id);
  if (!ad) notFound();

  const [industries, angles, creativeUrl] = await Promise.all([
    distinctValues(supabase, "industry"),
    distinctValues(supabase, "marketing_angle"),
    signedCreativeUrl(supabase, ad.creative_path),
  ]);
  return <AdForm mode="edit" ad={ad} industries={industries} angles={angles} creativeUrl={creativeUrl} />;
}
