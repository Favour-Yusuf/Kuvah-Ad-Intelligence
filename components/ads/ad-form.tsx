"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceSelect } from "@/components/forms/choice-select";
import { countryGroups, formatGroups, platformGroups } from "@/components/ads/choices";
import { apiFetch } from "@/lib/client-api";
import { createClient } from "@/lib/supabase/browser";
import type { AdRow } from "@/lib/supabase/types";
import { INDUSTRY_SUGGESTIONS } from "@/lib/validation/constants";
import { utcDate } from "@/lib/validation/ad";

const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4";
const MAX_BYTES = 25 * 1024 * 1024;

type Props = {
  mode: "create" | "edit";
  ad?: AdRow;
  industries: string[];
  angles: string[];
  creativeUrl?: string | null;
};

export function AdForm({ mode, ad, industries, angles, creativeUrl }: Props) {
  const router = useRouter();
  const ids = useId();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [platform, setPlatform] = useState<string | null>(ad?.platform ?? null);
  const [country, setCountry] = useState<string | null>(ad?.target_country ?? "US");
  const [format, setFormat] = useState<string | null>(ad?.format ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [permission, setPermission] = useState(false);
  const [removeCreative, setRemoveCreative] = useState(false);

  const industryOptions = [...new Set([...industries, ...INDUSTRY_SUGGESTIONS])].sort();

  async function uploadCreative(selected: File): Promise<string | null> {
    const issued = await apiFetch<{ path: string; token: string }>("/api/uploads", {
      method: "POST",
      body: { content_type: selected.type, size: selected.size, permission_confirmed: permission },
    });
    if (!issued.ok) {
      setErrors((e) => ({ ...e, creative: issued.fields?.permission_confirmed ?? issued.fields?.content_type ?? issued.error }));
      return null;
    }
    const { error } = await createClient()
      .storage.from("creatives")
      .uploadToSignedUrl(issued.data.path, issued.data.token, selected, { contentType: selected.type });
    if (error) {
      setErrors((e) => ({ ...e, creative: "Upload failed. Try again or save without the creative." }));
      return null;
    }
    return issued.data.path;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setErrors({});

    if (file) {
      if (!permission) {
        setErrors({ creative: "Confirm the team may store this creative for internal research." });
        return;
      }
      if (file.size > MAX_BYTES) {
        setErrors({ creative: "Files must be 25 MB or smaller." });
        return;
      }
    }

    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {};
    for (const key of [
      "source_url", "brand", "platform", "target_country", "industry", "format", "headline",
      "ad_copy", "creative_description", "cta", "observed_at", "research_notes", "marketing_angle",
    ]) {
      body[key] = (form.get(key) as string | null) ?? "";
    }

    if (file) {
      const path = await uploadCreative(file);
      if (!path) {
        setSubmitting(false);
        return;
      }
      body.creative_path = path;
    } else if (removeCreative) {
      body.creative_path = null;
    }

    const result =
      mode === "create"
        ? await apiFetch<{ ad: AdRow }>("/api/ads", { method: "POST", body })
        : await apiFetch<{ ad: AdRow }>(`/api/ads/${ad!.id}`, { method: "PATCH", body });

    if (!result.ok) {
      setErrors(result.fields ?? { form: result.error });
      setSubmitting(false);
      toast.error(result.error);
      return;
    }

    toast.success(mode === "create" ? "Ad saved to the library." : "Changes saved.");
    router.push(`/ads/${result.data.ad.id}`);
    router.refresh();
  }

  const err = (key: string) => (errors[key] ? `${ids}-${key}-error` : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-8">
      {errors.form ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}

      <Section title="Where you saw it" description="Kuvah stores the link as a reference. It never visits or downloads it.">
        <Field id="source_url" label="Source URL" required error={errors.source_url} errorId={err("source_url")}>
          <Input id="source_url" name="source_url" type="url" inputMode="url" placeholder="https://"
            defaultValue={ad?.source_url} aria-invalid={!!errors.source_url} aria-describedby={err("source_url")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="brand" label="Brand" required error={errors.brand} errorId={err("brand")}>
            <Input id="brand" name="brand" defaultValue={ad?.brand} maxLength={120}
              aria-invalid={!!errors.brand} aria-describedby={err("brand")} />
          </Field>
          <Field id="observed_at" label="Date observed" required error={errors.observed_at} errorId={err("observed_at")}>
            <Input id="observed_at" name="observed_at" type="date" max={utcDate(1)}
              defaultValue={ad?.observed_at ?? utcDate(0)} aria-invalid={!!errors.observed_at} aria-describedby={err("observed_at")} />
          </Field>
          <Field id="platform" label="Platform" required error={errors.platform} errorId={err("platform")}>
            <ChoiceSelect id="platform" name="platform" groups={platformGroups} value={platform} onValueChange={setPlatform}
              placeholder="Choose a platform" invalid={!!errors.platform} describedBy={err("platform")} />
          </Field>
          <Field id="target_country" label="Target country" required error={errors.target_country} errorId={err("target_country")}>
            <ChoiceSelect id="target_country" name="target_country" groups={countryGroups(ad?.target_country)} value={country}
              onValueChange={setCountry} placeholder="Choose a country" invalid={!!errors.target_country} describedBy={err("target_country")} />
          </Field>
          <Field id="format" label="Format" required error={errors.format} errorId={err("format")}>
            <ChoiceSelect id="format" name="format" groups={formatGroups} value={format} onValueChange={setFormat}
              placeholder="Choose a format" invalid={!!errors.format} describedBy={err("format")} />
          </Field>
          <Field id="industry" label="Industry" error={errors.industry} errorId={err("industry")}>
            <Input id="industry" name="industry" list={`${ids}-industries`} defaultValue={ad?.industry ?? ""} maxLength={80}
              aria-invalid={!!errors.industry} aria-describedby={err("industry")} />
            <datalist id={`${ids}-industries`}>
              {industryOptions.map((i) => <option key={i} value={i} />)}
            </datalist>
          </Field>
        </div>
      </Section>

      <Section title="What the ad says" description="Copy it exactly as shown. At least one of these is needed.">
        <Field id="headline" label="Headline" error={errors.headline} errorId={err("headline")}>
          <Input id="headline" name="headline" defaultValue={ad?.headline ?? ""} maxLength={300}
            aria-invalid={!!errors.headline} aria-describedby={err("headline")} />
        </Field>
        <Field id="ad_copy" label="Ad copy" error={errors.ad_copy} errorId={err("ad_copy")}>
          <Textarea id="ad_copy" name="ad_copy" rows={6} defaultValue={ad?.ad_copy ?? ""} maxLength={5000}
            aria-invalid={!!errors.ad_copy} aria-describedby={err("ad_copy")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cta" label="Call to action" hint="The button text, e.g. Shop now" error={errors.cta} errorId={err("cta")}>
            <Input id="cta" name="cta" defaultValue={ad?.cta ?? ""} maxLength={80}
              aria-invalid={!!errors.cta} aria-describedby={err("cta")} />
          </Field>
          <Field id="marketing_angle" label="Marketing angle" hint="Optional. You can also accept the AI's suggestion later."
            error={errors.marketing_angle} errorId={err("marketing_angle")}>
            <Input id="marketing_angle" name="marketing_angle" list={`${ids}-angles`} defaultValue={ad?.marketing_angle ?? ""}
              maxLength={120} aria-invalid={!!errors.marketing_angle} aria-describedby={err("marketing_angle")} />
            <datalist id={`${ids}-angles`}>
              {angles.map((a) => <option key={a} value={a} />)}
            </datalist>
          </Field>
        </div>
      </Section>

      <Section title="The creative" description="Describe what is shown. For video, cover the opening seconds, scenes and on-screen text.">
        <Field id="creative_description" label="Creative description" error={errors.creative_description}
          errorId={err("creative_description")}>
          <Textarea id="creative_description" name="creative_description" rows={5} defaultValue={ad?.creative_description ?? ""}
            maxLength={3000} aria-invalid={!!errors.creative_description} aria-describedby={err("creative_description")} />
        </Field>

        {creativeUrl && !removeCreative ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">A creative is attached.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setRemoveCreative(true)}>
              Remove it
            </Button>
          </div>
        ) : null}

        <Field id="creative" label={creativeUrl ? "Replace creative (optional)" : "Upload creative (optional)"}
          hint="JPG, PNG, WebP or MP4, up to 25 MB. Images can be included in AI analysis." error={errors.creative} errorId={err("creative")}>
          <Input id="creative" type="file" accept={ACCEPT} aria-invalid={!!errors.creative} aria-describedby={err("creative")}
            onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)} />
        </Field>
        {file ? (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={permission} onCheckedChange={(v) => setPermission(v === true)} className="mt-0.5" />
            <span>
              The Kuvah team may store this creative for internal research. It will not be republished or used in our own ads.
            </span>
          </label>
        ) : null}
      </Section>

      <Section title="Research notes">
        <Field id="research_notes" label="Notes" hint="What caught your eye, and why it might matter for Kuvah."
          error={errors.research_notes} errorId={err("research_notes")}>
          <Textarea id="research_notes" name="research_notes" rows={4} defaultValue={ad?.research_notes ?? ""} maxLength={5000}
            aria-invalid={!!errors.research_notes} aria-describedby={err("research_notes")} />
        </Field>
      </Section>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : mode === "create" ? "Save ad" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1">
        <span className="text-base font-medium">{title}</span>
        {description ? <span className="block text-sm text-muted-foreground">{description}</span> : null}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({ id, label, hint, required, error, errorId, children }: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive" aria-hidden> *</span> : null}
      </Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p id={errorId} className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
