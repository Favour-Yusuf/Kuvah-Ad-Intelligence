import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMemberPage } from "@/lib/auth";

export default function DashboardPage() {
  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your team&apos;s advertising research at a glance.</p>
      </header>
      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

async function DashboardContent() {
  const { member } = await requireMemberPage();
  return <p className="text-sm">Signed in as {member.displayName}. Research metrics arrive in a later module.</p>;
}
