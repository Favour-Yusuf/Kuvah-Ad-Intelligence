"use client";

import { useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceSelect, type ChoiceGroup } from "@/components/forms/choice-select";
import { countryGroups } from "@/components/ads/choices";
import { cn } from "@/lib/utils";
import type { AdFormat, AdPlatform } from "@/lib/supabase/types";
import {
  FORMATS,
  FORMAT_LABELS,
  LIBRARY_STATUSES,
  PLATFORMS,
  PLATFORM_LABELS,
  STATUS_LABELS,
  countryName,
} from "@/lib/validation/constants";
import { activeFilterCount, filtersToSearchParams, type LibraryFilters as Filters } from "@/lib/validation/filters";

const ALL = "__all__";

type Props = { filters: Filters; industries: string[]; angles: string[]; tags: string[] };

export function LibraryFilters({ filters, industries, angles, tags }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? "");

  /** Any filter change resets to page 1. */
  function apply(next: Partial<Filters>) {
    const params = filtersToSearchParams({ ...filters, ...next, page: next.page ?? 1 });
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    apply({ q: query.trim() || null });
  }

  function toggle<T extends string>(list: T[], value: T) {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  const single = (values: string[]): ChoiceGroup[] => [
    { choices: [{ value: ALL, label: "All" }, ...values.map((v) => ({ value: v, label: v }))] },
  ];
  const fromChoice = (v: string | null) => (v && v !== ALL ? v : null);

  const chips = buildChips(filters);

  return (
    <section aria-label="Search and filters" className={cn("flex flex-col gap-4", pending && "opacity-70")} aria-busy={pending}>
      <form onSubmit={onSearch} role="search" className="flex gap-2">
        <Label htmlFor="library-q" className="sr-only">
          Search ads
        </Label>
        <Input
          id="library-q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brand, headline, copy, notes…"
          maxLength={200}
          className="max-w-xl"
        />
        <Button type="submit" variant="secondary">
          <Search aria-hidden />
          Search
        </Button>
      </form>

      <div className="flex flex-wrap items-end gap-4">
        <ToggleGroup
          label="Platform"
          options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] }))}
          selected={filters.platforms}
          onToggle={(v) => apply({ platforms: toggle(filters.platforms, v as AdPlatform) })}
        />
        <ToggleGroup
          label="Format"
          options={FORMATS.map((f) => ({ value: f, label: FORMAT_LABELS[f] }))}
          selected={filters.formats}
          onToggle={(v) => apply({ formats: toggle(filters.formats, v as AdFormat) })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <FilterSelect id="f-country" label="Country"
          groups={[{ choices: [{ value: ALL, label: "All countries" }] }, ...countryGroups(filters.countries[0])]}
          value={filters.countries[0] ?? ALL} onChange={(v) => apply({ countries: fromChoice(v) ? [fromChoice(v)!] : [] })} />
        <FilterSelect id="f-industry" label="Industry" groups={single(industries)} value={filters.industry ?? ALL}
          onChange={(v) => apply({ industry: fromChoice(v) })} />
        <FilterSelect id="f-angle" label="Marketing angle" groups={single(angles)} value={filters.angle ?? ALL}
          onChange={(v) => apply({ angle: fromChoice(v) })} />
        <FilterSelect id="f-status" label="Analysis"
          groups={[{ choices: [{ value: ALL, label: "All" }, ...LIBRARY_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))] }]}
          value={filters.status ?? ALL} onChange={(v) => apply({ status: fromChoice(v) as Filters["status"] })} />
        <FilterSelect id="f-tag" label="Tag" groups={single(tags)} value={filters.tag ?? ALL}
          onChange={(v) => apply({ tag: fromChoice(v) })} />
        <FilterSelect id="f-sort" label="Sort by"
          groups={[{ choices: [{ value: "observed", label: "Date observed" }, { value: "captured", label: "Date captured" }] }]}
          value={filters.sort} onChange={(v) => apply({ sort: v === "captured" ? "captured" : "observed" })} />
      </div>

      {chips.length ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <Button key={chip.key} variant="secondary" size="xs" onClick={() => apply(chip.remove)} aria-label={`Remove filter ${chip.label}`}>
              {chip.label}
              <X aria-hidden />
            </Button>
          ))}
          {activeFilterCount(filters) > 1 ? (
            <Button variant="ghost" size="xs" onClick={() => { setQuery(""); apply({ q: null, platforms: [], countries: [], formats: [], industry: null, angle: null, status: null, tag: null }); }}>
              Clear all
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function buildChips(f: Filters): { key: string; label: string; remove: Partial<Filters> }[] {
  return [
    ...(f.q ? [{ key: "q", label: `“${f.q}”`, remove: { q: null } }] : []),
    ...f.platforms.map((p) => ({ key: `p-${p}`, label: PLATFORM_LABELS[p], remove: { platforms: f.platforms.filter((x) => x !== p) } })),
    ...f.countries.map((c) => ({ key: `c-${c}`, label: countryName(c), remove: { countries: f.countries.filter((x) => x !== c) } })),
    ...f.formats.map((x) => ({ key: `f-${x}`, label: FORMAT_LABELS[x], remove: { formats: f.formats.filter((y) => y !== x) } })),
    ...(f.industry ? [{ key: "industry", label: `Industry: ${f.industry}`, remove: { industry: null } }] : []),
    ...(f.angle ? [{ key: "angle", label: `Angle: ${f.angle}`, remove: { angle: null } }] : []),
    ...(f.status ? [{ key: "status", label: STATUS_LABELS[f.status], remove: { status: null } }] : []),
    ...(f.tag ? [{ key: "tag", label: `Tag: ${f.tag}`, remove: { tag: null } }] : []),
  ];
}

function ToggleGroup({ label, options, selected, onToggle }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <Button key={o.value} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => onToggle(o.value)}>
              {o.label}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}

function FilterSelect({ id, label, groups, value, onChange }: {
  id: string;
  label: string;
  groups: ChoiceGroup[];
  value: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <ChoiceSelect id={id} groups={groups} value={value} onValueChange={onChange} placeholder="All" />
    </div>
  );
}
