import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { getSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/?next=/dashboard");
  }
  return (
    <PortalShell active="/dashboard" session={session}>
      {children}
    </PortalShell>
  );
}