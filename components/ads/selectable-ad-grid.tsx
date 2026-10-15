"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export const MAX_COMPARE = 4;

type Item = { id: string; brand: string; card: ReactNode };

/** Grid of server-rendered cards with a selection bar for comparing. */
export function SelectableAdGrid({ items }: { items: Item[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const clear = () => setSelected([]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const canCompare = selected.length >= 2 && selected.length <= MAX_COMPARE;

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className="relative">
            <div className="absolute top-4 right-4 z-10">
              <Checkbox
                checked={selected.includes(item.id)}
                onCheckedChange={() => toggle(item.id)}
                aria-label={`Select ${item.brand}`}
              />
            </div>
            {item.card}
          </li>
        ))}
      </ul>

      {selected.length ? (
        <div
          role="region"
          aria-label="Selected ads"
          className="sticky bottom-4 z-20 mx-auto flex flex-wrap items-center gap-3 rounded-lg border bg-background/95 px-4 py-3 shadow-lg backdrop-blur"
        >
          <span className="text-sm" aria-live="polite">
            {selected.length} selected
          </span>
          {canCompare ? (
            <Button size="sm" nativeButton={false} render={<Link href={`/compare?ids=${selected.join(",")}`} />}>
              <Columns3 aria-hidden />
              Compare
            </Button>
          ) : (
            <Button size="sm" disabled title={`Select 2–${MAX_COMPARE} ads to compare`}>
              <Columns3 aria-hidden />
              Compare (2–{MAX_COMPARE})
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={clear}>
            Clear selection
          </Button>
        </div>
      ) : null}
    </>
  );
}
