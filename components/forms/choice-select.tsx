"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

export type Choice = { value: string; label: string };
export type ChoiceGroup = { label?: string; choices: Choice[] };

type Props = {
  id: string;
  name?: string;
  groups: ChoiceGroup[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
};

/** Single-choice select with readable labels; submits through a hidden input when `name` is set. */
export function ChoiceSelect({ id, name, groups, value, onValueChange, placeholder, invalid, describedBy, className }: Props) {
  const items = Object.fromEntries(groups.flatMap((g) => g.choices.map((c) => [c.value, c.label])));

  return (
    <Select name={name} items={items} value={value} onValueChange={(v) => onValueChange((v as string | null) ?? null)}>
      <SelectTrigger id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy} className={className ?? "w-full"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group, i) => (
          <SelectGroup key={group.label ?? i}>
            {i > 0 ? <SelectSeparator /> : null}
            {group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
            {group.choices.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
