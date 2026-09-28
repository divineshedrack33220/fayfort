"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CallLayer, CallStartButtons } from "@/components/ui/call-overlay";
import { PushNudge } from "@/components/pwa/push-nudge";
import { useCall } from "@/components/ui/use-call";
import { ChatAttachments } from "@/components/ui/chat-attachments";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { LightboxGallery } from "@/components/ui/image-viewer";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";
import type { ChatAttachment } from "@/lib/chat-types";
import {
  pendingFromFile,
  uploadChatFileWithProgress,
  type PendingChatAttachment,
} from "@/lib/chat-upload";
import { ChatSocket } from "@/lib/chat-socket";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  from: string;
  author: string;
  text: string;
  at: string;
  attachments?: ChatAttachment[];
};

type ChatThread = {
  id: string;
  customer: string;
  email: string;
  subject: string;
  ref: string;
  unread: number;
  status: string;
  lastActive: string;
  messages: ChatMessage[];
};

/** Shown as the caller on both sides of a call; staff names never reach this page. */
const SUPPORT_LABEL = "Fayfort support";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  NEEDS_REPLY: "Needs reply",
  RESOLVED: "Resolved",
};

export function Chat({
  initialThread,
  wsUrl,
}: {
  initialThread?: ChatThread | null;
  wsUrl?: string;
}) {
  const [thread, setThread] = useState<ChatThread | null>(initialThread ?? null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingChatAttachment[]>([]);
  // Per-file upload progress, keyed by the same key as `pending`. Absent means
  // the file has not started uploading yet.
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [replyBusy, setReplyBusy] = useState(false);
  const [typer, setTyper] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<ChatSocket | null>(null);
  const messages = useMemo(() => thread?.messages ?? [], [thread]);
  // Staff identity is not exposed on the thread payload, so the peer is the
  // support desk rather than an individual.
  const callPeer = SUPPORT_LABEL;
  // The socket is created in an effect below, so the call reads it lazily
  // rather than taking a value that would not exist yet.
  // Stable so the callbacks useCall hands back (and therefore the socket
  // effect below) do not change identity on every render.
  const getSocket = useCallback(() => socketRef.current, []);
  const call = useCall({ threadId: thread?.id, peer: callPeer, getSocket });

  const refreshThread = useCallback(async () => {
    try {
      const res = await fetch("/api/backend/portal/thread");
      if (!res.ok) return;
      const payload = (await res.json()) as { thread?: ChatThread };
      if (payload.thread) setThread(payload.thread);
    } catch {
      // keep the current view; a later event or reload will catch up
    }
  }, []);

  // Opening the chat counts as reading the staff replies, which clears the
  // sidebar Chat badge. Deferred a tick to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/backend/portal/thread/read", { method: "POST" })
        .then(() => window.dispatchEvent(new Event("fayfort:chat-read")))
        .catch(() => {});
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!wsUrl || !thread?.id) return;
    const socket = new ChatSocket(
      wsUrl,
      {
        onTyping: (_threadId, from, role) => {
          if (role === "staff") setTyper(from);
        },
        onStopped: () => setTyper(null),
        onMessage: (threadId) => {
          if (threadId === thread.id) void refreshThread();
        },
        onCall: call.handleSignal,
      },
      new Set([thread.id]),
    );
    socket.open();
    socketRef.current = socket;
    return () => {
      socket.close();
      socketRef.current = null;
      setTyper(null);
    };
  }, [wsUrl, thread?.id, refreshThread, call.handleSignal]);

  // Ceiling for the indicator if a "stopped" frame is ever missed.
  const typerTimer = useRef<number | null>(null);
  useEffect(() => {
    if (typerTimer.current) window.clearTimeout(typerTimer.current);
    if (typer) {
      typerTimer.current = window.setTimeout(() => setTyper(null), 5000);
    }
    return () => {
      if (typerTimer.current) window.clearTimeout(typerTimer.current);
    };
  }, [typer]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, thread?.id, typer]);

  const handleDraft = (value: string) => {
    setDraft(value);
    if (value.trim() && thread && !replyBusy) {
      socketRef.current?.notifyTyping(thread.id);
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if ((!text && pending.length === 0) || replyBusy) return;
    setReplyBusy(true);
    const queued = pending;
    setUploadProgress(Object.fromEntries(queued.map((entry) => [entry.key, 0])));
    try {
      const attachments: ChatAttachment[] = [];
      for (const entry of queued) {
        const result = await uploadChatFileWithProgress(entry.file, entry.kind, (percent) => {
          setUploadProgress((current) => ({ ...current, [entry.key]: percent }));
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        attachments.push(result.attachment);
      }
      const response = await fetch("/api/backend/portal/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, attachments }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        thread?: ChatThread;
        error?: string;
      };
      if (!response.ok || !payload.thread) {
        toast.error(payload.error ?? "Your message couldn’t be sent.");
        return;
      }
      setThread(payload.thread);
      setDraft("");
      clearPending();
      toast.success("Message sent to the Fayfort team");
    } catch {
      toast.error("Your message couldn’t be sent. Try again shortly.");
    } finally {
      setReplyBusy(false);
      // Keep a failed batch on screen; only the bars go away.
      setUploadProgress({});
    }
  };

  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    const accepted: PendingChatAttachment[] = [];
    for (const file of files) {
      const entry = pendingFromFile(file);
      if (entry) accepted.push(entry);
      else toast.error(`"${file.name}" is not an image or video file.`);
    }
    if (accepted.length > 0) {
      setPending((current) => [...current, ...accepted]);
    }
  };

  const clearPending = () => {
    setPending((current) => {
      for (const entry of current) URL.revokeObjectURL(entry.url);
      return [];
    });
  };

  const removePending = (key: string) => {
    setPending((current) => {
      const next = current.filter((entry) => entry.key !== key);
      const removed = current.find((entry) => entry.key === key);
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  };

  const insertEmoji = (emoji: string) => {
    setDraft((current) => `${current}${emoji}`);
  };

  return (
    // The shell gives Chat a definite-height column on this route, so `flex-1`
    // here resolves to real leftover space: the message list takes it and
    // scrolls, the composer stays pinned, and the document never scrolls.
    <div className="container-shell flex min-h-0 flex-1 flex-col py-4">
      <Card className="min-h-0 flex-1 overflow-hidden">
        {/* On phones the conversation strip sits above the thread, so its row is
            fixed and the thread takes the rest; from `lg` the pair becomes two
            columns of a single row. */}
        {/* The conversation strip is desktop-only: on phones the thread header
            already shows the subject and ref, so the strip is dead vertical
            space (Instagram keeps a phone chat a single full-height column). */}
        <CardContent className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden p-0 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="hidden min-h-0 flex-col border-r border-sand-100 lg:flex">
            <p className="px-5 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-sand-500 uppercase">
              Conversations
            </p>
            <ul className="flex min-h-0 flex-1 gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-y-auto">
              {thread ? (
                <li className="shrink-0 lg:w-full">
                  <div className="flex w-full items-center gap-3 rounded-lg bg-brand-50 px-3 py-2.5 text-left">
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-sand-100"
                    >
                      <MessageSquare className="size-5 text-brand-600" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-brand-900">
                        {thread.subject}
                      </span>
                      <span className="truncate font-mono text-xs text-sand-500">
                        {thread.ref}
                      </span>
                    </span>
                  </div>
                </li>
              ) : (
                <li className="p-3 text-sm text-sand-400">Loading conversation…</li>
              )}
            </ul>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-sand-100 px-3 py-2 sm:px-4 sm:py-3">
              <div className="flex min-w-0 flex-col">
                <p className="truncate font-display text-sm font-semibold text-brand-900">
                  {thread?.subject ?? "Fayfort chat"}
                </p>
                <p className="truncate font-mono text-xs text-sand-500">
                  {thread ? `${thread.ref} · ${STATUS_LABEL[thread.status] ?? thread.status}` : "…"}
                </p>
              </div>
              <CallStartButtons
                peer={callPeer}
                onStart={call.start}
                disabled={call.state.phase !== "idle" || !thread}
              />
            </div>

            <PushNudge className="mx-2 mt-1 shrink-0" />

            <div
              ref={scrollRef}
              aria-live="polite"
              aria-atomic="false"
              className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 sm:gap-2.5 sm:px-4 sm:py-5"
            >
              {messages.length > 0 ? (
                <p className="self-center rounded-full bg-sand-100 px-3 py-1 text-[10px] font-semibold tracking-widest text-sand-500 uppercase">
                  Today
                </p>
              ) : null}

              {messages.length === 0 && !replyBusy ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm font-medium text-sand-600">
                    No messages yet
                  </p>
                  <p className="max-w-xs text-xs leading-relaxed text-sand-400">
                    Send the first message — the Fayfort team replies on the
                    same thread.
                  </p>
                </div>
              ) : null}

              {messages.map((message) => {
                const mine = message.from === "customer";
                const hasMedia = Boolean(message.attachments?.length);
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex flex-col gap-1",
                      mine ? "items-end self-end" : "items-start self-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] overflow-hidden text-sm sm:max-w-[70%]",
                        mine ? "bg-brand-600 text-white" : "bg-sand-100 text-sand-800",
                        mine ? "rounded-2xl rounded-br-sm" : "rounded-2xl rounded-bl-sm",
                      )}
                    >
                      {hasMedia ? (
                        <ChatAttachments
                          attachments={message.attachments ?? []}
                          // Text brings its own top padding, so only then does the
                          // media need to sit flush above it.
                          className={message.text ? "m-2 mb-0" : "m-2"}
                        />
                      ) : null}
                      {message.text ? (
                        <div className="px-3.5 py-2.5 leading-relaxed">{message.text}</div>
                      ) : null}
                      {/* Timestamp sits inside the bubble, as in the staff room:
                          a caption row per message used to add a third of the
                          vertical gap between bubbles. */}
                      <span
                        className={cn(
                          "flex items-center justify-end self-end px-3.5 pb-2 text-[10px] tabular-nums",
                          mine ? "text-white/70" : "text-sand-500",
                        )}
                      >
                        {message.at}
                      </span>
                    </div>
                  </div>
                );
              })}
              {typer || replyBusy ? (
                <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-sm border border-sand-200 bg-white px-3.5 py-2 shadow-sm">
                  {replyBusy ? null : (
                    <span className="text-sand-600 text-xs">{typer} is typing</span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <span className="bg-sand-400 size-1.5 animate-pulse rounded-full" />
                    <span className="bg-sand-400 size-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
                    <span className="bg-sand-400 size-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-sand-100 px-2.5 py-2 sm:gap-3 sm:p-4">
              {pending.length > 0 ? (
                <LightboxGallery
                  items={pending.map((entry, position) => ({
                    url: entry.url,
                    kind: entry.kind,
                    alt: entry.kind === "video" ? `Video attachment ${position + 1}` : `Image attachment ${position + 1}`,
                  }))}
                  label="Attachments to send"
                  className="flex flex-wrap items-center gap-2"
                  itemClassName="relative"
                  triggerClassName="block"
                  imageClassName="h-16 w-20 rounded-lg border border-sand-200 object-cover"
                  renderItemAction={(_, position) => {
                    const entry = pending[position];
                    if (!entry) return null;
                    const percent = uploadProgress[entry.key];
                    const uploading = percent !== undefined;
                    return (
                      <>
                        {uploading ? (
                          <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-sand-950/70 text-[11px] font-semibold text-white tabular-nums">
                            <Progress
                              value={percent}
                              label={`Sending ${entry.file.name}`}
                              className="h-1 w-10 bg-white/30"
                              indicatorClassName="bg-white"
                            />
                            {percent}%
                          </span>
                        ) : null}
                        <button
                          type="button"
                          aria-label="Remove attachment"
                          // Removing mid-flight would orphan the upload, so the
                          // control is locked until the batch settles.
                          disabled={uploading}
                          onClick={() => removePending(entry.key)}
                          className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-sand-900 text-white shadow-sm transition-opacity hover:bg-sand-950 disabled:pointer-events-none disabled:opacity-40"
                        >
                          <X aria-hidden className="size-3" />
                        </button>
                      </>
                    );
                  }}
                />
              ) : null}

              <form
                onSubmit={send}
                className="flex items-center gap-1 rounded-full border border-sand-200 bg-sand-50 p-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 sm:p-1 sm:pr-1.5"
              >
                <EmojiPicker onSelect={insertEmoji} className="size-10 sm:size-9" />
                <button
                  type="button"
                  aria-label="Attach an image or video"
                  disabled={replyBusy}
                  onClick={() => fileRef.current?.click()}
                  className="text-sand-400 hover:bg-sand-100 hover:text-sand-700 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 sm:size-9"
                >
                  <Paperclip aria-hidden className="size-5" />
                </button>
                <input
                  value={draft}
                  onChange={(event) => handleDraft(event.target.value)}
                  placeholder="Message the Fayfort team…"
                  aria-label="Message"
                  // Inline, borderless like the staff composer: the pill around
                  // it carries the focus ring.
                  className="placeholder:text-sand-400 bg-transparent text-sand-900 focus:ring-0 min-w-0 flex-1 rounded-full px-2 py-1.5 text-sm focus:outline-none"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="sr-only"
                  aria-label="Attach image or video"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    if (files.length > 0) void addFiles(files);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="submit"
                  intent="accent"
                  size="sm"
                  disabled={(!draft.trim() && pending.length === 0) || replyBusy}
                  aria-label="Send message"
                  className="h-10 rounded-full px-4 sm:h-9 sm:px-3"
                >
                  <Send aria-hidden className="size-4" />
                  <span className="hidden sm:inline">
                    {replyBusy ? "Sending…" : "Send"}
                  </span>
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fixed-position ringing card and call window; renders only while a
          call is live, so it adds nothing to the resting layout. */}
      <CallLayer
        state={call.state}
        peer={callPeer}
        onAccept={call.accept}
        onDecline={call.decline}
        onCancel={call.hangUp}
        onHangUp={call.hangUp}
        onToggleMic={call.toggleMic}
        onToggleCamera={call.toggleCamera}
      />
    </div>
  );
}