"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-api";

/** Per-item note editing and removal inside a collection. */
export function CollectionItemControls({ collectionId, adId, note, canRemove }: {
  collectionId: string;
  adId: string;
  note: string | null;
  canRemove: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [busy, setBusy] = useState(false);

  async function saveNote() {
    setBusy(true);
    const result = await apiFetch(`/api/collections/${collectionId}/items`, { method: "PATCH", body: { ad_id: adId, note: value } });
    setBusy(false);
    if (!result.ok) return toast.error(result.fields?.note ?? result.error);
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const result = await apiFetch(`/api/collections/${collectionId}/items`, { method: "DELETE", body: { ad_id: adId } });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Removed from the collection. The ad is still in the library.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-b-lg border-x border-b bg-muted/30 p-3 text-sm">
      {editing ? (
        <>
          <Textarea aria-label="Collection note" rows={2} maxLength={2000} value={value} onChange={(e) => setValue(e.target.value)} />
          <div className="flex gap-2">
            <Button size="xs" onClick={saveNote} disabled={busy}>Save note</Button>
            <Button size="xs" variant="ghost" onClick={() => { setEditing(false); setValue(note ?? ""); }}>Cancel</Button>
          </div>
        </>
      ) : (
        <>
          <p className={note ? "whitespace-pre-wrap" : "text-muted-foreground"}>{note ?? "No note for this collection."}</p>
          <div className="flex gap-2">
            <Button size="xs" variant="outline" onClick={() => setEditing(true)}>{note ? "Edit note" : "Add note"}</Button>
            {canRemove ? (
              <Button size="xs" variant="ghost" onClick={remove} disabled={busy}>Remove</Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
