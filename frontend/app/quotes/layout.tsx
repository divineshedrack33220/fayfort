import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { getSession } from "@/lib/session";

export default async function QuotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/?next=/quotes");
  }
  return (
    <PortalShell active="/quotes" session={session}>
      {children}
    </PortalShell>
  );
}