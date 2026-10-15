import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Pencil } from "lucide-react";
import { AdCard } from "@/components/ads/ad-card";
import { SelectableAdGrid } from "@/components/ads/selectable-ad-grid";
import { CollectionFormDialog } from "@/components/collections/collection-form-dialog";
import { CollectionItemControls } from "@/components/collections/collection-item-controls";
import { DeleteCollectionButton } from "@/components/collections/delete-collection-button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, GridSkeleton } from "@/components/layout/states";
import { Button } from "@/components/ui/button";
import { parseId } from "@/lib/api";
import { requireMemberPage } from "@/lib/auth";
import { getCollection } from "@/lib/data/collections";

export const metadata: Metadata = { title: "Collection" };

export default function CollectionPage({ params }: PageProps<"/collections/[id]">) {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <Collection params={params} />
    </Suspense>
  );
}

async function Collection({ params }: { params: PageProps<"/collections/[id]">["params"] }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const { supabase, member } = await requireMemberPage();
  const data = await getCollection(supabase, id);
  if (!data) notFound();
  const { collection, items } = data;
  const isAdmin = member.role === "admin";

  return (
    <>
      <PageHeader
        title={collection.name}
        description={collection.description ?? `${items.length} ${items.length === 1 ? "ad" : "ads"}`}
        actions={
          <>
            <CollectionFormDialog
              collection={collection}
              trigger={<Button variant="outline" size="sm" />}
              triggerLabel={
                <>
                  <Pencil aria-hidden />
                  Edit
                </>
              }
            />
            {collection.created_by === member.id || isAdmin ? (
              <DeleteCollectionButton id={collection.id} name={collection.name} />
            ) : null}
          </>
        }
      />

      {items.length ? (
        <SelectableAdGrid
          items={items.map((item) => ({
            id: item.ad.id,
            brand: item.ad.brand,
            card: (
              <div className="flex h-full flex-col [&>article]:rounded-b-none">
                <AdCard ad={item.ad} />
                <CollectionItemControls
                  collectionId={collection.id}
                  adId={item.ad.id}
                  note={item.note}
                  canRemove={item.added_by === member.id || isAdmin}
                />
              </div>
            ),
          }))}
        />
      ) : (
        <EmptyState
          title="This collection is empty"
          description="Select ads in the library and choose “Add to collection”, or add one from an ad's page."
          action={<Button nativeButton={false} render={<Link href="/ads" />}>Open the library</Button>}
        />
      )}
    </>
  );
}
