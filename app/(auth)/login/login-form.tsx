"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/browser";

const ERRORS: Record<string, string> = {
  link: "That sign-in link is invalid or has expired. Request a new one.",
  "not-member": "Your account is not on the Kuvah team. Ask an admin to invite you.",
};

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

export function LoginForm() {
  const params = useSearchParams();
  const urlError = ERRORS[params.get("error") ?? ""];
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = z.email().safeParse(new FormData(event.currentTarget).get("email"));
    if (!email.success) {
      setStatus({ kind: "error", message: "Enter a valid email address." });
      return;
    }

    setStatus({ kind: "sending" });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.data,
      options: {
        // Invite-only: never create accounts from the sign-in form.
        shouldCreateUser: false,
        emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    // Rate limiting is the only error worth surfacing. Everything else gets the
    // same neutral message so the form does not reveal who has an account.
    if (error && error.status === 429) {
      setStatus({ kind: "error", message: "Too many attempts. Wait a minute and try again." });
      return;
    }
    setStatus({ kind: "sent" });
  }

  if (status.kind === "sent") {
    return (
      <Alert>
        <AlertDescription>
          If that address belongs to a Kuvah team member, a sign-in link is on its way. Check your inbox.
        </AlertDescription>
      </Alert>
    );
  }

  const message = status.kind === "error" ? status.message : urlError;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {message ? (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" disabled={status.kind === "sending"}>
        {status.kind === "sending" ? "Sending link…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
