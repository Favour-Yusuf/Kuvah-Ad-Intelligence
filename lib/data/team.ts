import "server-only";
import { toDataError, type Db } from "./client";

/** user_id -> display name, for attributing notes and activity. */
export async function teamNames(db: Db): Promise<Map<string, string>> {
  const { data, error } = await db.from("team_members").select("user_id, display_name");
  if (error) throw toDataError(error, "load the team");
  return new Map(data.map((m) => [m.user_id, m.display_name || "Team member"]));
}
