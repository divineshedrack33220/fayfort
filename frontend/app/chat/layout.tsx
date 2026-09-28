import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/shell";
import { getSession } from "@/lib/session";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/?next=/chat");
  }
  return (
    <PortalShell active="/chat" session={session}>
      {children}
    </PortalShell>
  );
}