"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-api";

type Props = {
  trigger: ReactElement;
  triggerLabel: React.ReactNode;
  collection?: { id: string; name: string; description: string | null };
};

/** Create (no `collection`) or edit a collection's name and description. */
export function CollectionFormDialog({ trigger, triggerLabel, collection }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = { name: String(form.get("name") ?? ""), description: String(form.get("description") ?? "") };
    setSaving(true);
    const result = collection
      ? await apiFetch(`/api/collections/${collection.id}`, { method: "PATCH", body })
      : await apiFetch<{ collection: { id: string } }>("/api/collections", { method: "POST", body });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.fields ?? { form: result.error });
      return;
    }
    setOpen(false);
    toast.success(collection ? "Collection updated." : "Collection created.");
    if (!collection && result.data && typeof result.data === "object" && "collection" in result.data) {
      router.push(`/collections/${(result.data as { collection: { id: string } }).collection.id}`);
    }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setErrors({}); }}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{collection ? "Edit collection" : "New collection"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" name="name" defaultValue={collection?.name} maxLength={120} required aria-invalid={!!errors.name} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-description">Description (optional)</Label>
            <Textarea id="c-description" name="description" rows={3} maxLength={1000} defaultValue={collection?.description ?? ""} />
          </div>
          {errors.form ? <p role="alert" className="text-sm text-destructive">{errors.form}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : collection ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
