import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { getPortalRequests } from "@/lib/data/portal";
import { getSession } from "@/lib/session";

/**
 * Single session gate for the whole customer portal. Rendering the shell here
 * (instead of one shell per section) means the app bar, sidebar and bottom
 * tabs stay mounted across navigation — only the section below swaps — which
 * is what makes the portal feel instant and app-like on a phone.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const requests = await getPortalRequests();
  const hasRequests = requests.length > 0;

  return (
    <PortalShell session={session} hasRequests={hasRequests}>
      {children}
    </PortalShell>
  );
}