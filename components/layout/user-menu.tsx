import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireMemberPage } from "@/lib/auth";

/** Reads the session, so it must render inside a Suspense boundary. */
export async function UserMenu() {
  const { member } = await requireMemberPage();
  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      <div className="min-w-0 px-3">
        <p className="truncate text-sm font-medium">{member.displayName}</p>
        <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
      </div>
      <form action="/auth/signout" method="post">
        <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
          <LogOut aria-hidden />
          Sign out
        </Button>
      </form>
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex flex-col gap-2 border-t px-3 pt-4" aria-hidden>
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="h-3 w-12 animate-pulse rounded bg-muted" />
    </div>
  );
}
