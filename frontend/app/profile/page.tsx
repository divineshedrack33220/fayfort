import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LogoutButton } from "@/components/auth/logout-button";
import { EditProfileDialog } from "@/components/portal/edit-profile-dialog";
import { getPortalProfile } from "@/lib/data/portal";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Profile",
  description:
    "Your Fayfort account details, contact information and preferences.",
};

export default async function ProfilePage() {
  const session = await getSession();
  const profile = await getPortalProfile();
  const userName = profile?.name ?? session?.name ?? "David Green";

  return (
    <div className="container-shell flex flex-col gap-5 py-6 sm:gap-6 sm:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-900 sm:text-4xl">
          Your account
        </h1>
        <p className="text-sm text-sand-500">
          How Fayfort knows who you are, and where your notifications go.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <Card>
          <CardContent className="flex flex-col gap-6 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-600 font-display text-base font-semibold text-white">
                  {userName
                    .split(" ")
                    .map((part) => part.charAt(0))
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div className="flex min-w-0 flex-col">
                  <p className="truncate font-display text-lg font-semibold text-brand-900">
                    {userName}
                  </p>
                  <p className="truncate text-sm text-sand-500">{session?.email ?? profile?.email ?? "—"}</p>
                </div>
              </div>

              <EditProfileDialog
                initialName={userName}
                initialEmail={session?.email ?? profile?.email ?? ""}
              />
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:gap-4">
              {[
                { label: "Role", value: "Customer" },
                { label: "Plan", value: "Starter (quote-based)" },
                { label: "Country", value: profile?.city ?? "Nigeria" },
                { label: "Member since", value: profile?.joined ?? "Sep 2026" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="rounded-lg border border-sand-200 bg-sand-50/60 px-3 py-2.5"
                >
                  <dt className="text-[10px] font-semibold tracking-widest text-sand-500 uppercase">
                    {row.label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-brand-900">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="rounded-lg bg-brand-50 px-3 py-2.5 text-xs leading-relaxed text-brand-800">
              Profile details come from your Fayfort account.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <p className="font-display text-sm font-semibold text-brand-900">
              Notifications
            </p>
            <p className="mt-1 text-sm leading-relaxed text-sand-500">
              Status updates for your sourcing requests land here.
            </p>
          </Card>
          <Card className="p-5">
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-display text-sm font-semibold text-brand-900">
                  Authentication
                </p>
                <p className="mt-1 text-sm leading-relaxed text-sand-500">
                  A secure session cookie keeps you signed in to your account.
                </p>
              </div>
              <LogoutButton className="flex w-full items-center justify-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm font-medium text-sand-700 transition-colors hover:bg-sand-50">
                <LogOut aria-hidden className="size-4" />
                Log out
              </LogoutButton>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}