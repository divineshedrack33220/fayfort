import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand wordmark + the Fayfort icon mark (asset at /icon.png).
 */
export function SiteLogo({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/icon.png"
        alt=""
        aria-hidden
        width={28}
        height={28}
        className={cn(
          "size-7 shrink-0 rounded-md",
          onDark ? "ring-2 ring-white/10" : "ring-2 ring-brand-100",
        )}
      />
      <span
        className={cn(
          "font-display text-lg font-semibold tracking-tight",
          onDark ? "text-white" : "text-brand-900",
        )}
      >
        Fayfort
      </span>
      <span className="sr-only">Fayfort Sourcing</span>
    </span>
  );
}