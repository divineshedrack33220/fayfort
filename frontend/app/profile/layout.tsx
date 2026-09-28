import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { getSession } from "@/lib/session";

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/?next=/profile");
  }
  return (
    <PortalShell active="/profile" session={session}>
      {children}
    </PortalShell>
  );
}