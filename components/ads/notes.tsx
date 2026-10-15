"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-api";

export type NoteView = { id: string; body: string; authorName: string; createdLabel: string; canDelete: boolean };

/** Timestamped team notes on an ad. */
export function Notes({ adId, notes }: { adId: string; notes: NoteView[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await apiFetch(`/api/ads/${adId}/notes`, { method: "POST", body: { body } });
    setSaving(false);
    if (!result.ok) {
      setError(result.fields?.body ?? result.error);
      return;
    }
    setBody("");
    router.refresh();
  }

  async function remove(id: string) {
    const result = await apiFetch(`/api/notes/${id}`, { method: "DELETE" });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Note deleted.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <Textarea
          aria-label="New note"
          placeholder="Add a research note for the team"
          rows={3}
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={!!error}
        />
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
        <Button type="submit" size="sm" className="self-start" disabled={saving || !body.trim()}>
          {saving ? "Adding…" : "Add note"}
        </Button>
      </form>

      {notes.length ? (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border p-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {n.authorName} · {n.createdLabel}
                </span>
                {n.canDelete ? (
                  <Button variant="ghost" size="icon-xs" onClick={() => remove(n.id)} aria-label="Delete note">
                    <Trash2 aria-hidden />
                  </Button>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      )}
    </div>
  );
}
