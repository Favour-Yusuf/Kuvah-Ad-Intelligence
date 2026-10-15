"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceSelect } from "@/components/forms/choice-select";
import { apiFetch } from "@/lib/client-api";

const NEW = "__new__";

type Props = {
  adIds: string[];
  collections: { id: string; name: string }[];
  onDone?: () => void;
  size?: "sm" | "xs";
};

/** Adds ads to an existing collection, or creates one with them. */
export function AddToCollection({ adIds, collections, onDone, size = "sm" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(collections[0]?.id ?? NEW);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const groups = [
    {
      choices: [...collections.map((c) => ({ value: c.id, label: c.name })), { value: NEW, label: "+ New collection" }],
    },
  ];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const note = String(form.get("note") ?? "");
    setSaving(true);

    let message: string;
    if (target === NEW) {
      const result = await apiFetch<{ collection: { id: string; name: string } }>("/api/collections", {
        method: "POST",
        body: { name: String(form.get("name") ?? ""), description: null, ad_ids: adIds },
      });
      setSaving(false);
      if (!result.ok) return setError(result.fields?.name ?? result.error);
      message = `Created “${result.data.collection.name}”.`;
    } else {
      const result = await apiFetch<{ added: number; skipped: number }>(`/api/collections/${target}/items`, {
        method: "POST",
        body: { ad_ids: adIds, note },
      });
      setSaving(false);
      if (!result.ok) return setError(result.error);
      const name = collections.find((c) => c.id === target)?.name ?? "the collection";
      message =
        result.data.added === 0
          ? `Already in ${name}.`
          : `Added ${result.data.added} ${result.data.added === 1 ? "ad" : "ads"} to ${name}${result.data.skipped ? ` (${result.data.skipped} already there)` : ""}.`;
    }

    toast.success(message);
    setOpen(false);
    onDone?.();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <DialogTrigger render={<Button size={size} variant="outline" />}>
        <FolderPlus aria-hidden />
        Add to collection
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Add to collection</DialogTitle>
            <DialogDescription>
              {adIds.length === 1 ? "Save this ad" : `Save ${adIds.length} ads`} to a collection the whole team can see.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="collection-target">Collection</Label>
            <ChoiceSelect id="collection-target" groups={groups} value={target} onValueChange={setTarget} placeholder="Choose" />
          </div>

          {target === NEW ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="collection-name">New collection name</Label>
              <Input id="collection-name" name="name" maxLength={120} required aria-invalid={!!error} />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="collection-note">Note (optional)</Label>
              <Textarea id="collection-note" name="note" rows={2} maxLength={2000} placeholder="Why it belongs here" />
            </div>
          )}

          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
