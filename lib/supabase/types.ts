// Database types. Hand-maintained to match supabase/migrations.
// Once the Supabase CLI is linked, `npx supabase gen types typescript --linked`
// produces an equivalent file.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TeamRole = "admin" | "member";
export type AdPlatform = "facebook" | "instagram" | "tiktok" | "google";
export type AdFormat = "image" | "video" | "carousel" | "text" | "other";
export type AnalysisStatus = "pending" | "complete" | "failed";
export type LibraryAnalysisStatus = AnalysisStatus | "none";

type Timestamps = { created_at: string; updated_at: string };

export type AdRow = {
  id: string;
  created_by: string | null;
  source_type: string;
  source_url: string;
  brand: string;
  platform: AdPlatform;
  target_country: string;
  industry: string | null;
  format: AdFormat;
  headline: string | null;
  ad_copy: string | null;
  creative_description: string | null;
  cta: string | null;
  observed_at: string;
  research_notes: string | null;
  marketing_angle: string | null;
  creative_path: string | null;
  search: unknown;
} & Timestamps;

type AdWritable = Omit<AdRow, "id" | "search" | "created_at" | "updated_at" | "created_by">;

export type AdAnalysisRow = {
  id: string;
  ad_id: string;
  status: AnalysisStatus;
  provider: string;
  model: string;
  input_hash: string;
  result: Json | null;
  warnings: string[];
  error: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
};

export type CollectionRow = {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
} & Timestamps;

export type CollectionItemRow = {
  collection_id: string;
  ad_id: string;
  added_by: string | null;
  added_at: string;
  note: string | null;
};

export type TagRow = { id: string; name: string; created_at: string };
export type AdTagRow = { ad_id: string; tag_id: string };

export type AdNoteRow = {
  id: string;
  ad_id: string;
  author: string | null;
  body: string;
  created_at: string;
};

export type TeamMemberRow = {
  user_id: string;
  role: TeamRole;
  display_name: string | null;
  created_at: string;
};

export type AdLibraryRow = AdRow & {
  analysis_status: LibraryAnalysisStatus;
  latest_analysis_id: string | null;
  latest_analysis_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      team_members: {
        Row: TeamMemberRow;
        Insert: { user_id: string; role?: TeamRole; display_name?: string | null; created_at?: string };
        Update: { role?: TeamRole; display_name?: string | null };
        Relationships: [];
      };
      ads: {
        Row: AdRow;
        Insert: Partial<AdWritable> & Pick<AdWritable, "source_url" | "brand" | "platform" | "target_country" | "format" | "observed_at"> & { id?: string; created_by?: string | null };
        Update: Partial<AdWritable>;
        Relationships: [];
      };
      ad_analyses: {
        Row: AdAnalysisRow;
        Insert: {
          id?: string;
          ad_id: string;
          status?: AnalysisStatus;
          provider: string;
          model: string;
          input_hash: string;
          result?: Json | null;
          warnings?: string[];
          error?: string | null;
          created_by?: string | null;
          completed_at?: string | null;
        };
        Update: {
          status?: AnalysisStatus;
          result?: Json | null;
          warnings?: string[];
          error?: string | null;
          completed_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "ad_analyses_ad_id_fkey"; columns: ["ad_id"]; isOneToOne: false; referencedRelation: "ads"; referencedColumns: ["id"] },
        ];
      };
      collections: {
        Row: CollectionRow;
        Insert: { id?: string; name: string; description?: string | null; created_by?: string | null };
        Update: { name?: string; description?: string | null };
        Relationships: [];
      };
      collection_items: {
        Row: CollectionItemRow;
        Insert: { collection_id: string; ad_id: string; note?: string | null; added_by?: string | null };
        Update: { note?: string | null };
        Relationships: [
          { foreignKeyName: "collection_items_collection_id_fkey"; columns: ["collection_id"]; isOneToOne: false; referencedRelation: "collections"; referencedColumns: ["id"] },
          { foreignKeyName: "collection_items_ad_id_fkey"; columns: ["ad_id"]; isOneToOne: false; referencedRelation: "ads"; referencedColumns: ["id"] },
        ];
      };
      tags: {
        Row: TagRow;
        Insert: { id?: string; name: string };
        Update: { name?: string };
        Relationships: [];
      };
      ad_tags: {
        Row: AdTagRow;
        Insert: AdTagRow;
        Update: Partial<AdTagRow>;
        Relationships: [
          { foreignKeyName: "ad_tags_ad_id_fkey"; columns: ["ad_id"]; isOneToOne: false; referencedRelation: "ads"; referencedColumns: ["id"] },
          { foreignKeyName: "ad_tags_tag_id_fkey"; columns: ["tag_id"]; isOneToOne: false; referencedRelation: "tags"; referencedColumns: ["id"] },
        ];
      };
      ad_notes: {
        Row: AdNoteRow;
        Insert: { id?: string; ad_id: string; body: string; author?: string | null };
        Update: { body?: string };
        Relationships: [
          { foreignKeyName: "ad_notes_ad_id_fkey"; columns: ["ad_id"]; isOneToOne: false; referencedRelation: "ads"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: {
      ad_library: {
        Row: AdLibraryRow;
        Relationships: [];
      };
    };
    Functions: {
      is_team_member: { Args: Record<string, never>; Returns: boolean };
      is_team_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      team_role: TeamRole;
      ad_platform: AdPlatform;
      ad_format: AdFormat;
      analysis_status: AnalysisStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};
