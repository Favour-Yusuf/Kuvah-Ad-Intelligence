import Link from "next/link";
import { Suspense } from "react";
import { NavLinks, NavList } from "@/components/layout/nav-links";
import { UserMenu, UserMenuSkeleton } from "@/components/layout/user-menu";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b bg-muted/30 p-4 md:w-60 md:border-r md:border-b-0">
        <Link href="/" className="px-3 text-base font-semibold tracking-tight">
          Kuvah Ad Intelligence
        </Link>
        <Suspense fallback={<NavList pathname={null} />}>
          <NavLinks />
        </Suspense>
        <div className="mt-auto">
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-8">{children}</main>
    </div>
  );
}
