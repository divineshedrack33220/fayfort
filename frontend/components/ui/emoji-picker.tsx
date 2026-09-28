"use client";

import { Smile } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const EMOJIS = [
  "😀",
  "😊",
  "😉",
  "😂",
  "😅",
  "🤝",
  "🙏",
  "👍",
  "👏",
  "💪",
  "🤞",
  "🙌",
  "👋",
  "✅",
  "❌",
  "⚠️",
  "🔥",
  "💡",
  "💯",
  "📦",
  "🚚",
  "🛳️",
  "✈️",
  "🏭",
  "🛠️",
  "📋",
  "📊",
  "📅",
  "🕒",
  "📧",
  "💬",
  "📞",
  "🤔",
  "😌",
  "😮",
  "😬",
  "😢",
  "😤",
  "🥳",
  "🎉",
  "🎯",
  "💰",
  "💸",
  "🏷️",
  "✨",
  "⭐",
  "🔍",
  "📌",
  "🔒",
  "🔑",
  "❤️",
  "😍",
  "🎁",
  "🧾",
  "📄",
  "🏆",
];

/**
 * Compact emoji picker for chat composers. Renders a smiley trigger and a
 * small popover grid that closes on outside click / Escape / selection.
 */
export function EmojiPicker({
  onSelect,
  className,
}: {
  onSelect: (emoji: string) => void;
  /** Extra classes for the trigger, e.g. a larger tap target on phones. */
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="Add emoji"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "text-sand-400 hover:bg-sand-100 hover:text-sand-700 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors",
          className,
        )}
      >
        <Smile aria-hidden className="size-5" />
      </button>
      {open ? (
        <div className="bg-sand-50/60 z-30 absolute right-0 bottom-full mb-2 grid w-72 grid-cols-8 gap-0.5 rounded-xl border border-sand-200 bg-white p-2 shadow-pop">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Insert ${emoji}`}
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              className="hover:bg-sand-100 flex size-8 items-center justify-center rounded-lg text-lg transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}