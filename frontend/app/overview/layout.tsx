import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { getSession } from "@/lib/session";

export default async function OverviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/?next=/overview");
  }
  return (
    <PortalShell active="/overview" session={session}>
      {children}
    </PortalShell>
  );
}