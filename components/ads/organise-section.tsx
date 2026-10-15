import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddToCollection } from "@/components/collections/add-to-collection";
import type { Member } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { AdNoteRow } from "@/lib/supabase/types";
import { Notes, type NoteView } from "./notes";
import { TagEditor } from "./tag-editor";

type Props = {
  adId: string;
  member: Member;
  tags: string[];
  tagSuggestions: string[];
  memberOf: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  notes: AdNoteRow[];
  names: Map<string, string>;
};

/** Tags, collections and notes for one ad. */
export function OrganiseSection({ adId, member, tags, tagSuggestions, memberOf, collections, notes, names }: Props) {
  const noteViews: NoteView[] = notes.map((n) => ({
    id: n.id,
    body: n.body,
    authorName: (n.author && names.get(n.author)) || "Former member",
    createdLabel: formatDateTime(n.created_at),
    canDelete: n.author === member.id || member.role === "admin",
  }));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Organise</CardTitle>
          <CardDescription>Tags and collections are shared with the team.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Tags</h3>
            <TagEditor adId={adId} initial={tags} suggestions={tagSuggestions} />
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Collections</h3>
            {memberOf.length ? (
              <ul className="flex flex-wrap gap-2 text-sm">
                {memberOf.map((c) => (
                  <li key={c.id}>
                    <Link href={`/collections/${c.id}`} className="text-primary underline-offset-4 hover:underline">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Not in any collection.</p>
            )}
            <div>
              <AddToCollection adIds={[adId]} collections={collections.filter((c) => !memberOf.some((m) => m.id === c.id))} />
            </div>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team notes</CardTitle>
          <CardDescription>Observations and ideas from the team. Separate from the AI analysis.</CardDescription>
        </CardHeader>
        <CardContent>
          <Notes adId={adId} notes={noteViews} />
        </CardContent>
      </Card>
    </div>
  );
}
