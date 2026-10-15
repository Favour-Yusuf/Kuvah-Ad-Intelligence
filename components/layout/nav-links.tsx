"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CirclePlus, Columns3, FolderOpen, History, LayoutDashboard, Library } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ads", label: "Ad library", icon: Library },
  { href: "/ads/new", label: "Capture ad", icon: CirclePlus },
  { href: "/collections", label: "Collections", icon: FolderOpen },
  { href: "/compare", label: "Compare", icon: Columns3 },
  { href: "/analyses", label: "Analyses", icon: History },
] as const;

export function isActiveLink(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/ads/new") return pathname === "/ads/new";
  // The library owns /ads and individual ad pages, but not the capture form.
  if (href === "/ads") return pathname === "/ads" || (pathname.startsWith("/ads/") && pathname !== "/ads/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavList({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && isActiveLink(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-muted font-medium text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function NavLinks() {
  return <NavList pathname={usePathname()} />;
}
