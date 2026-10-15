import { z } from "zod";

// Control characters other than tab, newline and carriage return.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Trims, strips control characters and normalises line endings. */
export function cleanText(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "").trim();
}

/** Required text: cleaned, non-empty, length-capped. */
export function requiredText(max: number, label: string) {
  return z
    .string({ error: `${label} is required.` })
    .transform(cleanText)
    .pipe(z.string().min(1, `${label} is required.`).max(max, `${label} must be ${max} characters or fewer.`));
}

/** Optional text: cleaned; empty strings become null. */
export function optionalText(max: number, label: string) {
  return z
    .string()
    .nullish()
    .transform((v) => (v == null ? null : cleanText(v)))
    .pipe(
      z
        .string()
        .max(max, `${label} must be ${max} characters or fewer.`)
        .nullable()
        .transform((v) => (v ? v : null)),
    );
}

export const uuid = z.uuid({ error: "Invalid id." });
