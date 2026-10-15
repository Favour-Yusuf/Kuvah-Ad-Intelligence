import { ExternalLink } from "lucide-react";
import { hostname } from "@/lib/format";

/** The ad's source, always visible. Opened in a new tab without passing referrer or opener. */
export function SourceLink({ url, className }: { url: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      referrerPolicy="no-referrer"
      className={`inline-flex min-w-0 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline ${className ?? ""}`}
    >
      <span className="truncate">{hostname(url)}</span>
      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">(opens the original source in a new tab)</span>
    </a>
  );
}
