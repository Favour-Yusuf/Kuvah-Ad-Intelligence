import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FolderPlus } from "lucide-react";
import { CollectionFormDialog } from "@/components/collections/collection-form-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, GridSkeleton } from "@/components/layout/states";
import { Button } from "@/components/ui/button";
import { requireMemberPage } from "@/lib/auth";
import { listCollections } from "@/lib/data/collections";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Collections" };

export default function CollectionsPage() {
  return (
    <>
      <PageHeader
        title="Collections"
        description="Group ads by theme, campaign or test idea."
        actions={
          <CollectionFormDialog
            trigger={<Button />}
            triggerLabel={
              <>
                <FolderPlus aria-hidden />
                New collection
              </>
            }
          />
        }
      />
      <Suspense fallback={<GridSkeleton />}>
        <CollectionList />
      </Suspense>
    </>
  );
}

async function CollectionList() {
  const { supabase } = await requireMemberPage();
  const collections = await listCollections(supabase);

  if (!collections.length) {
    return (
      <EmptyState
        title="No collections yet"
        description="Create one here, or select ads in the library and choose “Add to collection”."
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {collections.map((c) => (
        <li key={c.id}>
          <Link
            href={`/collections/${c.id}`}
            className="flex h-full flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/30"
          >
            <span className="font-medium">{c.name}</span>
            {c.description ? <span className="line-clamp-2 text-sm text-muted-foreground">{c.description}</span> : null}
            <span className="mt-auto text-xs text-muted-foreground">
              {c.item_count} {c.item_count === 1 ? "ad" : "ads"}
              {c.last_added_at ? ` · last added ${formatDate(c.last_added_at)}` : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
