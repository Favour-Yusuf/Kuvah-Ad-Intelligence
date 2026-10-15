import Link from "next/link";
import { EmptyState } from "@/components/layout/states";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      title="Not found"
      description="It may have been deleted, or the link is wrong."
      action={<Button nativeButton={false} render={<Link href="/ads" />}>Back to the library</Button>}
    />
  );
}
