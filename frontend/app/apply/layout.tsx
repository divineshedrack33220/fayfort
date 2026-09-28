import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { getSession } from "@/lib/session";

export default async function ApplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/?next=/apply");
  }
  return (
    <PortalShell active="/apply" session={session}>
      {children}
    </PortalShell>
  );
}