"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/client-api";

export function DeleteAdButton({ adId, brand }: { adId: string; brand: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    setDeleting(true);
    const result = await apiFetch(`/api/ads/${adId}`, { method: "DELETE" });
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    toast.success("Ad deleted.");
    router.push("/ads");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        <Trash2 aria-hidden />
        Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this ad?</DialogTitle>
          <DialogDescription>
            This removes the {brand} ad, its analyses, notes and collection entries for the whole team. It cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" onClick={onDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete ad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
