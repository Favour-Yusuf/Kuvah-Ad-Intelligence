import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TeamRole } from "@/lib/supabase/types";

export type Member = {
  id: string;
  email: string | null;
  displayName: string;
  role: TeamRole;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

type MemberLookup =
  | { status: "ok"; supabase: Supabase; member: Member }
  | { status: "signed-out" }
  | { status: "not-member"; supabase: Supabase };

/** Verifies the session with Supabase Auth and loads the team membership. Deduped per request. */
const lookupMember = cache(async (): Promise<MemberLookup> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "signed-out" };

  const { data: row } = await supabase
    .from("team_members")
    .select("role, display_name")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!row) return { status: "not-member", supabase };

  return {
    status: "ok",
    supabase,
    member: {
      id: data.user.id,
      email: data.user.email ?? null,
      displayName: row.display_name || data.user.email || "Team member",
      role: row.role,
    },
  };
});

/** For Server Components: returns the member and a user-scoped client, or redirects. */
export async function requireMemberPage() {
  const result = await lookupMember();
  if (result.status === "signed-out") redirect("/login");
  if (result.status === "not-member") redirect("/login?error=not-member");
  return { supabase: result.supabase, member: result.member };
}

/** For Route Handlers: returns the member, or a ready-made 401/403 response. */
export async function requireMemberApi(): Promise<
  { ok: true; supabase: Supabase; member: Member } | { ok: false; response: NextResponse }
> {
  const result = await lookupMember();
  if (result.status === "signed-out") {
    return { ok: false, response: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }
  if (result.status === "not-member") {
    return { ok: false, response: NextResponse.json({ error: "Not a member of the Kuvah team." }, { status: 403 }) };
  }
  return { ok: true, supabase: result.supabase, member: result.member };
}
