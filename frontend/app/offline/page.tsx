import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-sand-50 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
        <WifiOff aria-hidden className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold text-sand-900">
          You&apos;re offline
        </h1>
        <p className="max-w-sm text-sm text-sand-600">
          Fayfort needs a connection to load your dashboard. Reconnect and try
          again — your data is safe.
        </p>
      </div>
      <Button asChild intent="primary">
        <Link href="/">Back to Fayfort</Link>
      </Button>
    </main>
  );
}
