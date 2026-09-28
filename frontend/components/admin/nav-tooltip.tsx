"use client";

import { createPortal } from "react-dom";

export interface NavHintState {
  href: string;
  label: string;
  text: string;
  rect: DOMRect;
}

export const NAV_TOOLTIP_ID = "admin-nav-tooltip";

const WIDTH = 320;

/**
 * Hover/focus tooltip for the admin sidebar. Rendered through a portal on
 * document.body so the sidebar's own scroll container (overflow-y-auto) can
 * never clip it, and positioned in viewport space against the hovered link.
 */
export function NavTooltip({ hint }: { hint: NavHintState | null }) {
  // Portals need document.body, which doesn't exist during SSR. The hint is
  // always null on the server, so this never causes a hydration mismatch.
  if (typeof document === "undefined" || !hint) return null;

  const spaceRight = window.innerWidth - hint.rect.right;
  const onRight = spaceRight > WIDTH + 40;
  const left = onRight ? hint.rect.right + 14 : Math.max(12, hint.rect.right - WIDTH - 14);
  const top = Math.min(
    Math.max(hint.rect.top + hint.rect.height / 2, 104),
    window.innerHeight - 104,
  );

  return createPortal(
    <div
      id={NAV_TOOLTIP_ID}
      role="tooltip"
      style={{ left, top }}
      className="pointer-events-none fixed z-50 w-80 -translate-y-1/2 rounded-xl border border-white/10 bg-sand-900 px-3.5 py-3 text-left shadow-xl shadow-brand-950/50"
    >
      {onRight ? (
        <span
          aria-hidden
          className="absolute top-1/2 -left-[3px] size-1.5 -translate-y-1/2 rotate-45 border-b border-l border-white/10 bg-sand-900"
        />
      ) : null}
      <p className="font-display text-xs font-semibold text-white">{hint.label}</p>
      <p className="mt-1 text-xs leading-relaxed text-sand-300">{hint.text}</p>
    </div>,
    document.body,
  );
}
