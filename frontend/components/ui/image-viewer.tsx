"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, ExternalLink, X, ZoomIn, ZoomOut } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/** One item the viewer can display. `kind` defaults to an image. */
export interface LightboxItem {
  url: string;
  alt: string;
  kind?: "image" | "video";
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
/** Extra room the image may drift from centre, as a fraction of the surface. */
const OVERSCAN = 0.4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface LightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LightboxItem[];
  /** Zero-based index of the visible item. */
  index?: number;
  onIndexChange?: (index: number) => void;
  /** Shown above and below the media, e.g. a product name. */
  caption?: React.ReactNode;
  className?: string;
}

/**
 * Full-screen media viewer.
 *
 * Deliberately not built on the shared `Modal`: a lightbox needs an edge to
 * edge dark surface with no padding and a transform-driven zoom layer, neither
 * of which the centred white dialog can express. It still uses Radix Dialog
 * underneath, so focus trapping, scroll locking, `aria-modal` and
 * Escape-to-close behave like every other dialog in the app.
 */
export function Lightbox({
  open,
  onOpenChange,
  items,
  index = 0,
  onIndexChange,
  caption,
  className,
}: LightboxProps) {
  const surfaceRef = React.useRef<MediaSurfaceHandle>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const total = items.length;
  const safeIndex = total === 0 ? 0 : clamp(index, 0, total - 1);
  const item = items[safeIndex];
  const canNavigate = total > 1;
  const isVideo = item?.kind === "video";

  const step = React.useCallback(
    (delta: number) => {
      if (!canNavigate) return;
      onIndexChange?.((safeIndex + delta + total) % total);
    },
    [canNavigate, onIndexChange, safeIndex, total],
  );

  // The trigger is a plain button next to the gallery, not a Radix
  // `DialogPrimitive.Trigger`, so Radix has no opener to hand focus back to and
  // closing strands keyboard users on <body>. Remember the opener and restore it
  // on close, which also lands focus back on the admin dialog this was opened
  // from when the viewer is used inside one.
  React.useEffect(() => {
    if (open) {
      openerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      return;
    }
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener?.isConnected) opener.focus();
  }, [open]);

  React.useEffect(() => {
    if (!open || !canNavigate) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, canNavigate, step]);

  if (!item) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="animate-overlay-in bg-sand-950/95 data-[state=closed]:animate-overlay-out fixed inset-0 z-[100] backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "animate-scale-in focus:outline-none fixed inset-0 z-[101] flex flex-col",
            className,
          )}
          onOpenAutoFocus={(event) => {
            // The media surface is the useful focus target, not the close button.
            event.preventDefault();
            surfaceRef.current?.focusSurface();
          }}
        >
          <DialogPrimitive.Title className="sr-only">{item.alt}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Full screen media viewer
          </DialogPrimitive.Description>

          <header className="flex shrink-0 items-center justify-between gap-3 px-3 py-2 sm:px-5">
            <p className="min-w-0 truncate text-sm text-white/70">{caption}</p>
            <div className="flex shrink-0 items-center gap-1">
              {canNavigate ? (
                <span className="mr-1 text-sm font-medium tabular-nums text-white/70">
                  {safeIndex + 1} / {total}
                </span>
              ) : null}
              {isVideo ? null : (
                <MediaControls surfaceRef={surfaceRef} />
              )}
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                aria-label="Open in a new tab"
                className="flex size-11 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
              >
                <ExternalLink aria-hidden className="size-5" />
              </a>
              <DialogPrimitive.Close
                aria-label="Close viewer"
                className="flex size-11 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
              >
                <X aria-hidden className="size-5" />
              </DialogPrimitive.Close>
            </div>
          </header>

          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {canNavigate ? (
              <ViewerNav
                side="left"
                label="Previous"
                onClick={() => step(-1)}
                className="left-1 sm:left-4"
              />
            ) : null}

            {/*
              Keyed by URL and only mounted while open, so switching item or
              closing and reopening always starts from an unzoomed, centred
              image without any state-resetting effect.
            */}
            {open ? (
              <MediaSurface
                key={item.url}
                ref={surfaceRef}
                item={item}
                onStep={step}
                canNavigate={canNavigate}
              />
            ) : (
              <div className="h-full w-full" />
            )}

            {canNavigate ? (
              <ViewerNav
                side="right"
                label="Next"
                onClick={() => step(1)}
                className="right-1 sm:right-4"
              />
            ) : null}
          </div>

          {caption ? (
            <p className="shrink-0 truncate px-4 pb-3 text-center text-sm text-white/70 sm:pb-4">
              {caption}
            </p>
          ) : (
            <div className="h-3 sm:h-4" />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface MediaSurfaceHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  focusSurface: () => void;
}

/** Zoom buttons live in the header, but the state lives on the surface. */
function MediaControls({ surfaceRef }: { surfaceRef: React.RefObject<MediaSurfaceHandle | null> }) {
  return (
    <>
      <ViewerButton label="Zoom out" onClick={() => surfaceRef.current?.zoomOut()}>
        <ZoomOut aria-hidden className="size-5" />
      </ViewerButton>
      <ViewerButton label="Zoom in" onClick={() => surfaceRef.current?.zoomIn()}>
        <ZoomIn aria-hidden className="size-5" />
      </ViewerButton>
    </>
  );
}

const MediaSurface = React.forwardRef<
  MediaSurfaceHandle,
  {
    item: LightboxItem;
    onStep: (delta: number) => void;
    canNavigate: boolean;
  }
>(function MediaSurface({ item, onStep, canNavigate }, ref) {
  const [scale, setScale] = React.useState(MIN_SCALE);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  const surface = React.useRef<HTMLDivElement>(null);
  const scaleRef = React.useRef(MIN_SCALE);
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const gesture = React.useRef<{
    startX: number;
    startY: number;
    startTime: number;
    originX: number;
    originY: number;
    startDistance: number;
    startScale: number;
    moved: boolean;
  } | null>(null);

  React.useImperativeHandle(ref, () => ({
    zoomIn: () => setScale((s) => clamp(s * 1.5, MIN_SCALE, MAX_SCALE)),
    zoomOut: () => {
      setScale((s) => {
        const next = clamp(s / 1.5, MIN_SCALE, MAX_SCALE);
        if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
        return next;
      });
    },
    focusSurface: () => surface.current?.focus(),
  }));

  const isVideo = item.kind === "video";

  // Keeps a zoomed image from being dragged off screen.
  const clampOffset = React.useCallback((next: { x: number; y: number }, factor: number) => {
    const el = surface.current;
    if (!el || factor <= 1) return { x: 0, y: 0 };
    const limitX = (el.clientWidth * (factor - 1)) / 2 + el.clientWidth * OVERSCAN;
    const limitY = (el.clientHeight * (factor - 1)) / 2 + el.clientHeight * OVERSCAN;
    return { x: clamp(next.x, -limitX, limitX), y: clamp(next.y, -limitY, limitY) };
  }, []);

  /** Zooms to `next`, keeping the point under `origin` anchored on screen. */
  const zoomAround = React.useCallback(
    (next: number, origin?: { x: number; y: number }) => {
      setScale((current) => {
        const target = clamp(next, MIN_SCALE, MAX_SCALE);
        if (target === current) return current;
        if (target === MIN_SCALE) setOffset({ x: 0, y: 0 });
        setOffset((currentOffset) => {
          const el = surface.current;
          if (!el || !origin || target === MIN_SCALE) return target === MIN_SCALE ? { x: 0, y: 0 } : currentOffset;
          const rect = el.getBoundingClientRect();
          const cx = origin.x - rect.left - rect.width / 2;
          const cy = origin.y - rect.top - rect.height / 2;
          const ratio = target / current;
          return clampOffset(
            { x: cx - (cx - currentOffset.x) * ratio, y: cy - (cy - currentOffset.y) * ratio },
            target,
          );
        });
        return target;
      });
    },
    [clampOffset],
  );

  // React's `onWheel` is registered passively, so `preventDefault` there is
  // ignored (and Chrome logs a warning) — the page behind would scroll while
  // zooming. A native non-passive listener is the only way to claim the gesture.
  React.useEffect(() => {
    scaleRef.current = scale;
    const el = surface.current;
    if (!el || isVideo) return;
    const onNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAround(scaleRef.current * Math.exp(-event.deltaY * 0.002), {
        x: event.clientX,
        y: event.clientY,
      });
    };
    el.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => el.removeEventListener("wheel", onNativeWheel);
  }, [isVideo, scale, zoomAround]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (isVideo) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      gesture.current = {
        startX: event.clientX,
        startY: event.clientY,
        startTime: event.timeStamp,
        originX: offset.x,
        originY: offset.y,
        startDistance: 0,
        startScale: scale,
        moved: false,
      };
      setDragging(false);
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        ...(gesture.current ?? {
          startX: 0,
          startY: 0,
          startTime: event.timeStamp,
          originX: offset.x,
          originY: offset.y,
          startDistance: 0,
          startScale: scale,
          moved: false,
        }),
        startDistance: Math.hypot(a.x - b.x, a.y - b.y),
      };
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (isVideo || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;

    if (pointers.current.size >= 2 && g.startDistance > 0) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const target = clamp((g.startScale * distance) / g.startDistance, MIN_SCALE, MAX_SCALE);
      setScale(target);
      if (target === MIN_SCALE) setOffset({ x: 0, y: 0 });
      g.moved = true;
      return;
    }

    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) > 6) {
      g.moved = true;
      setDragging(true);
    }

    if (scale > MIN_SCALE) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setOffset(clampOffset({ x: g.originX + dx, y: g.originY + dy }, scale));
    }
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(event.pointerId);
    gesture.current = pointers.current.size >= 1 ? g : null;
    setDragging(false);
    if (!g || isVideo) return;

    // A fast, horizontal flick while unzoomed pages to the next item. A slow
    // drag is deliberately ignored: those are pans and stray taps, not a swipe.
    // (No `g.moved` check here — moving more than the 6px slop sets it, and that
    // is exactly what a real swipe does.)
    if (pointers.current.size === 0 && scaleRef.current === MIN_SCALE) {
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      const elapsed = Math.max(1, event.timeStamp - g.startTime);
      const velocity = Math.abs(dx) / elapsed;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5 && velocity > 0.25) {
        onStep(dx < 0 ? 1 : -1);
      }
    }
  };

  return (
    <div
      ref={surface}
      tabIndex={-1}
      role="group"
      aria-label={item.alt}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(event) =>
        zoomAround(scale > MIN_SCALE ? MIN_SCALE : 2, {
          x: event.clientX,
          y: event.clientY,
        })
      }
      className={cn(
        "flex h-full w-full touch-none items-center justify-center select-none focus:outline-none",
        isVideo ? "cursor-default" : "cursor-zoom-in",
        scale > MIN_SCALE && !dragging && "cursor-grab",
        dragging && "cursor-grabbing",
      )}
    >
      {isVideo ? (
        <video
          src={item.url}
          controls
          autoPlay
          playsInline
          preload="metadata"
          aria-label={item.alt}
          className="max-h-full max-w-full bg-black object-contain"
        />
      ) : loadFailed ? (
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <p className="text-sm text-white/80">This image could not be loaded.</p>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            Open it directly
          </a>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt={item.alt}
          draggable={false}
          onError={() => setLoadFailed(true)}
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            transition: dragging ? "none" : "transform 150ms ease-out",
          }}
          className="max-h-full max-w-full bg-black/40 object-contain"
        />
      )}
      {canNavigate ? <span className="sr-only">Swipe or use the arrow keys to change image</span> : null}
    </div>
  );
});

function ViewerButton({
  label,
  children,
  className,
  ...props
}: React.ComponentPropsWithRef<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex size-11 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function ViewerNav({
  side,
  label,
  className,
  ...props
}: React.ComponentPropsWithRef<"button"> & { side: "left" | "right"; label: string }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/90 transition-colors hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none md:flex",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className="size-7" />
    </button>
  );
}

export interface LightboxGalleryProps {
  items: LightboxItem[];
  className?: string;
  /** Applied to each thumbnail's media element. */
  imageClassName?: string;
  /** Applied to each thumbnail's trigger button. */
  triggerClassName?: string;
  /**
   * Wrapper around each thumbnail, for layouts that need to position something
   * over it. Only added when `renderItemAction` is used, so plain galleries keep
   * their direct button children.
   */
  itemClassName?: string;
  /**
   * Extra control layered over a thumbnail, e.g. an uploader's remove button.
   * Rendered as a *sibling* of the trigger, never inside it, so the two stay
   * independently clickable.
   */
  renderItemAction?: (item: LightboxItem, index: number) => React.ReactNode;
  caption?: React.ReactNode;
  /** Accessible name for the group of triggers. */
  label?: string;
}

/**
 * A row or grid of thumbnails that open the full-screen viewer when clicked.
 *
 * Self-contained on purpose: no provider and no global state, so a server
 * component can render it directly from serialisable props, and prev/next stay
 * scoped to the images that genuinely belong together.
 */
export function LightboxGallery({
  items,
  className,
  imageClassName,
  triggerClassName,
  itemClassName,
  renderItemAction,
  caption,
  label = "Images",
}: LightboxGalleryProps) {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const visible = React.useMemo(
    () => (items ?? []).filter((item): item is LightboxItem => Boolean(item && item.url)),
    [items],
  );

  if (visible.length === 0) return null;

  return (
    <>
      <div className={className} role="group" aria-label={label}>
        {visible.map((item, position) => {
          const trigger = (
            <button
              key={`${item.url}-${position}`}
              type="button"
              aria-label={`View ${item.alt}`}
              onClick={() => {
                setIndex(position);
                setOpen(true);
              }}
              className={cn(
                "group focus-visible:ring-brand-500/60 overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                triggerClassName,
              )}
            >
              {item.kind === "video" ? (
                <video
                  src={item.url}
                  muted
                  playsInline
                  preload="metadata"
                  aria-hidden
                  tabIndex={-1}
                  className={imageClassName}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.alt}
                  loading="lazy"
                  draggable={false}
                  className={imageClassName}
                />
              )}
            </button>
          );

          if (!renderItemAction) return trigger;

          return (
            <div key={`${item.url}-${position}`} className={itemClassName}>
              {trigger}
              {renderItemAction(item, position)}
            </div>
          );
        })}
      </div>

      <Lightbox
        open={open}
        onOpenChange={setOpen}
        items={visible}
        index={index}
        onIndexChange={setIndex}
        caption={caption}
      />
    </>
  );
}

export interface LightboxTriggerProps {
  /** The first item is shown as the thumbnail; the rest are reachable inside. */
  items: LightboxItem[];
  className?: string;
  imageClassName?: string;
  /** Accessible name for the thumbnail button. */
  label: string;
  caption?: React.ReactNode;
}

/**
 * One small thumbnail — a table cell, an avatar, a list row — that opens the
 * viewer on the whole set rather than a bespoke link out to the file. Used where
 * there is no room for a grid of thumbnails.
 */
export function LightboxTrigger({
  items,
  className,
  imageClassName,
  label,
  caption,
}: LightboxTriggerProps) {
  const [open, setOpen] = React.useState(false);
  const visible = React.useMemo(
    () => (items ?? []).filter((item): item is LightboxItem => Boolean(item && item.url)),
    [items],
  );
  const first = visible[0];
  if (!first) return null;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className={cn(
          "group focus-visible:ring-brand-500/60 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          className,
        )}
      >
        {first.kind === "video" ? (
          <video
            src={first.url}
            muted
            playsInline
            preload="metadata"
            aria-hidden
            tabIndex={-1}
            className={imageClassName}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={first.url} alt="" loading="lazy" draggable={false} className={imageClassName} />
        )}
      </button>

      <Lightbox
        open={open}
        onOpenChange={setOpen}
        items={visible}
        caption={caption}
      />
    </>
  );
}
