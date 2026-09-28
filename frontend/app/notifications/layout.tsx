import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { getSession } from "@/lib/session";

export default async function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/?next=/notifications");
  }
  return (
    <PortalShell active="/notifications" session={session}>
      {children}
    </PortalShell>
  );
}