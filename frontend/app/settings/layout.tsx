import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { getSession } from "@/lib/session";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/?next=/settings");
  }
  return (
    <PortalShell active="/settings" session={session}>
      {children}
    </PortalShell>
  );
}