"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client-api";

/** Edits an ad's tags. Each change saves the full set. */
export function TagEditor({ adId, initial, suggestions }: { adId: string; initial: string[]; suggestions: string[] }) {
  const router = useRouter();
  const listId = useId();
  const [tags, setTags] = useState(initial);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(next: string[]) {
    const previous = tags;
    setTags(next);
    setSaving(true);
    const result = await apiFetch<{ tags: string[] }>(`/api/ads/${adId}/tags`, { method: "PUT", body: { tags: next } });
    setSaving(false);
    if (!result.ok) {
      setTags(previous);
      toast.error(result.fields?.tags ?? result.error);
      return;
    }
    setTags(result.data.tags);
    router.refresh();
  }

  function add() {
    const name = draft.trim().replace(/\s+/g, " ");
    if (!name) return;
    setDraft("");
    if (tags.some((t) => t.toLowerCase() === name.toLowerCase())) return;
    void save([...tags, name]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {tags.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {tags.map((t) => (
            <li key={t}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {t}
                <button
                  type="button"
                  onClick={() => save(tags.filter((x) => x !== t))}
                  disabled={saving}
                  className="rounded-sm opacity-70 hover:opacity-100"
                  aria-label={`Remove tag ${t}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No tags yet.</p>
      )}
      <div className="flex gap-2">
        <Input
          aria-label="Add a tag"
          placeholder="Add a tag, e.g. UGC"
          value={draft}
          maxLength={40}
          list={listId}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className="max-w-xs"
        />
        <datalist id={listId}>
          {suggestions.filter((s) => !tags.includes(s)).map((s) => <option key={s} value={s} />)}
        </datalist>
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={saving || !draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
