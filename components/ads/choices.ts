import type { ChoiceGroup } from "@/components/forms/choice-select";
import { FORMATS, FORMAT_LABELS, OTHER_COUNTRIES, PLATFORMS, PLATFORM_LABELS, PRIORITY_COUNTRIES, countryName } from "@/lib/validation/constants";

export const platformGroups: ChoiceGroup[] = [
  { choices: PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] })) },
];

export const formatGroups: ChoiceGroup[] = [{ choices: FORMATS.map((f) => ({ value: f, label: FORMAT_LABELS[f] })) }];

/** Focus markets first. Includes `extra` (e.g. an existing value) if it is not already listed. */
export function countryGroups(extra?: string | null): ChoiceGroup[] {
  const others: string[] = [...OTHER_COUNTRIES];
  if (extra && !others.includes(extra) && !(PRIORITY_COUNTRIES as readonly string[]).includes(extra)) others.push(extra);
  const toChoice = (code: string) => ({ value: code, label: `${countryName(code)} (${code})` });
  return [
    { label: "Focus markets", choices: PRIORITY_COUNTRIES.map(toChoice) },
    { label: "Other markets", choices: others.map(toChoice).sort((a, b) => a.label.localeCompare(b.label)) },
  ];
}
