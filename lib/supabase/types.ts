// Database types. Hand-maintained to match supabase/migrations.
// Regenerate with `npx supabase gen types typescript` once the CLI is linked.

export type TeamRole = "admin" | "member";

export type Database = {
  public: {
    Tables: {
      team_members: {
        Row: { user_id: string; role: TeamRole; display_name: string | null; created_at: string };
        Insert: { user_id: string; role?: TeamRole; display_name?: string | null; created_at?: string };
        Update: { role?: TeamRole; display_name?: string | null };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_team_member: { Args: Record<string, never>; Returns: boolean };
      is_team_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { team_role: TeamRole };
    CompositeTypes: Record<never, never>;
  };
};
