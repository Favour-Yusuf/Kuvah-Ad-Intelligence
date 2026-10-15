import "server-only";
import type { AdNoteRow } from "@/lib/supabase/types";
import { DataError, toDataError, type Db } from "./client";

export async function listNotes(db: Db, adId: string): Promise<AdNoteRow[]> {
  const { data, error } = await db.from("ad_notes").select("*").eq("ad_id", adId).order("created_at", { ascending: false });
  if (error) throw toDataError(error, "load notes");
  return data;
}

export async function addNote(db: Db, adId: string, body: string): Promise<AdNoteRow> {
  const { data, error } = await db.from("ad_notes").insert({ ad_id: adId, body }).select("*").single();
  if (error) throw toDataError(error, "add the note");
  return data;
}

export async function deleteNote(db: Db, id: string): Promise<void> {
  const { data, error } = await db.from("ad_notes").delete().eq("id", id).select("id");
  if (error) throw toDataError(error, "delete the note");
  if (!data.length) throw new DataError("Only the note's author, or an admin, can delete it.", 403);
}
