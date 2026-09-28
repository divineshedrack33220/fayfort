"use client";

import * as React from "react";
import {
  ArrowLeft,
  CheckCheck,
  MessagesSquare,
  Paperclip,
  Search,
  Send,
  X,
} from "lucide-react";
import { CallLayer, CallStartButtons } from "@/components/ui/call-overlay";
import { PushNudge } from "@/components/pwa/push-nudge";
import { useCall } from "@/components/ui/use-call";
import { ChatAttachments, attachmentPreviewLabel } from "@/components/ui/chat-attachments";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { LightboxGallery } from "@/components/ui/image-viewer";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toast";
import type { ChatAttachment } from "@/lib/chat-types";
import {
  pendingFromFile,
  uploadChatFileWithProgress,
  type PendingChatAttachment,
} from "@/lib/chat-upload";
import { ChatSocket } from "@/lib/chat-socket";
import type { AdminThread, AdminThreadMessage } from "@/lib/admin";
import { cn } from "@/lib/utils";

const AVATAR_TINTS = [
  "bg-brand-100 text-brand-800",
  "bg-accent-100 text-accent-700",
  "bg-success-100 text-success-700",
  "bg-sand-200 text-sand-800",
  "bg-sand-100 text-sand-700",
] as const;

function initialsOf(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function timeOf(at: string): string {
  return at.trim().startsWith("Just now") ? "Just now" : at;
}

interface MessagesInboxProps {
  initialThreads: AdminThread[];
  activeId: string | null;
  staffName?: string;
  onReply: (threadId: string, text: string, attachments?: ChatAttachment[]) => Promise<void>;
  wsUrl?: string;
}

export function MessagesInbox({ initialThreads, activeId, staffName, onReply, wsUrl }: MessagesInboxProps) {
  const [query, setQuery] = React.useState("");
  const [composed, setComposed] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState<PendingChatAttachment[]>([]);
  // Per-file upload progress, keyed by attachment key; absent means not started.
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});
  const [uploading, setUploading] = React.useState(false);
  const [extra, setExtra] = React.useState<Record<string, AdminThreadMessage[]>>({});
  const [readIds, setReadIds] = React.useState<Set<string>>(
    () => new Set(activeId ? [activeId] : []),
  );
  const [threads, setThreads] = React.useState<AdminThread[]>(initialThreads);
  const [typingBy, setTypingBy] = React.useState<Record<string, string>>({});
  // Which conversation the room shows. Switching it is a local state change:
  // the URL is kept in sync with history.replaceState below, so moving between
  // threads never refetches the page (nice on the dedicated mobile layout,
  // which has no room side-by-side list).
  const [selectedId, setSelectedId] = React.useState<string | null>(activeId ?? null);
  const socketRef = React.useRef<ChatSocket | null>(null);
  const subscribedRef = React.useRef<Set<string> | null>(null);
  const typingTimers = React.useRef<Record<string, number>>({});
  // The list-only view shows the newest thread, so calls act on whichever
  // thread the room is actually displaying.
  const roomThread =
    threads.find((thread) => thread.id === selectedId) ?? (!selectedId ? threads[0] ?? null : null);
  // The socket is created in an effect below, so the call reads it lazily
  // rather than taking a value that would not exist yet.
  const callPeer = roomThread?.customer ?? "the customer";
  // Stable so the callbacks useCall hands back (and therefore the socket
  // effect below) do not change identity on every render.
  const getSocket = React.useCallback(() => socketRef.current, []);
  const call = useCall({ threadId: roomThread?.id, peer: callPeer, getSocket });

  // Realtime updates come from the WS-driven refreshThreads(); server actions
  // don't need to re-sync state because a reply is fetched on success too.
  const refreshThreads = React.useCallback(async () => {
    try {
      const res = await fetch("/api/backend/admin/messages");
      if (!res.ok) return;
      const payload = (await res.json()) as { threads?: AdminThread[] };
      if (payload.threads) setThreads(payload.threads);
    } catch {
      // keep the current view; a later event or reload will catch up
    }
  }, []);

  const clearTyping = React.useCallback((threadId: string) => {
    setTypingBy((prev) => {
      if (!(threadId in prev)) return prev;
      const next = { ...prev };
      delete next[threadId];
      return next;
    });
  }, []);

  const armTypingTimer = React.useCallback(
    (threadId: string) => {
      if (typingTimers.current[threadId]) window.clearTimeout(typingTimers.current[threadId]);
      typingTimers.current[threadId] = window.setTimeout(() => {
        delete typingTimers.current[threadId];
        clearTyping(threadId);
      }, 5000);
    },
    [clearTyping],
  );

  const cancelTypingTimer = React.useCallback((threadId: string) => {
    const id = typingTimers.current[threadId];
    if (id) {
      window.clearTimeout(id);
      delete typingTimers.current[threadId];
    }
  }, []);

  React.useEffect(() => {
    if (!wsUrl) return;
    const socket = new ChatSocket(
      wsUrl,
      {
        onTyping: (threadId, from, role) => {
          if (role !== "customer") return;
          setTypingBy((prev) => (prev[threadId] === from ? prev : { ...prev, [threadId]: from }));
          armTypingTimer(threadId);
        },
        onStopped: (threadId) => {
          cancelTypingTimer(threadId);
          clearTyping(threadId);
        },
        onMessage: () => void refreshThreads(),
        // A brand-new conversation can arrive on a thread id the inbox doesn't
        // know about yet; the backend fires "threads" so the list refetches.
        onThreads: () => void refreshThreads(),
        onCall: call.handleSignal,
      },
    );
    socket.open();
    socketRef.current = socket;
    return () => {
      socket.close();
      socketRef.current = null;
      subscribedRef.current = null;
      for (const threadId of Object.keys(typingTimers.current)) {
        window.clearTimeout(typingTimers.current[threadId]);
      }
      typingTimers.current = {};
    };
  }, [wsUrl, refreshThreads, armTypingTimer, cancelTypingTimer, clearTyping, call.handleSignal]);

  // Track every thread so a message in any conversation wakes this inbox,
  // not just the one currently open.
  React.useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const wanted = new Set(threads.map((thread) => thread.id));
    const current = subscribedRef.current ?? new Set<string>();
    for (const id of current) {
      if (!wanted.has(id)) socket.unsubscribe(id);
    }
    for (const id of wanted) {
      if (!current.has(id)) socket.subscribe(id);
    }
    subscribedRef.current = wanted;
  }, [threads]);

  // Opening a conversation counts as reading it: clear the local unread count
  // immediately and persist it so the badge, the list pill and the "new
  // messages" divider stay cleared after a reload.
  const markRead = React.useCallback((id: string) => {
    setReadIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    setThreads((prev) =>
      prev.map((thread) => (thread.id === id && thread.unread !== 0 ? { ...thread, unread: 0 } : thread)),
    );
    void fetch(`/api/backend/admin/messages/${encodeURIComponent(id)}/read`, {
      method: "POST",
    })
      .then((res) => {
        // Let the sidebar badge react immediately rather than on its next poll.
        if (res.ok) window.dispatchEvent(new Event("fayfort:messages-read"));
      })
      .catch(() => {});
  }, []);

  /** Opens a conversation without a router round-trip. */
  const selectThread = React.useCallback(
    (id: string) => {
      setSelectedId(id);
      markRead(id);
      if (window.location.pathname !== `/admin/messages/${id}`) {
        window.history.replaceState(null, "", `/admin/messages/${id}`);
      }
    },
    [markRead],
  );

  /** Mobile reveals the conversation list by clearing the open thread. */
  const showList = React.useCallback(() => {
    setSelectedId(null);
    window.history.replaceState(null, "", "/admin/messages");
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (thread) =>
        thread.customer.toLowerCase().includes(q) ||
        thread.subject.toLowerCase().includes(q) ||
        thread.ref.toLowerCase().includes(q),
    );
  }, [threads, query]);


  const messages = React.useMemo(
    () =>
      roomThread ? [...roomThread.messages, ...(extra[roomThread.id] ?? [])] : [],
    [roomThread, extra],
  );
  const listRef = React.useRef<HTMLOListElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // The conversation open in the chat room is read by definition, so persist
  // that on open (covers direct visits and the default first thread).
  // Deferred a tick to satisfy react-hooks/set-state-in-effect.
  React.useEffect(() => {
    if (!roomThread?.id) return;
    const timer = window.setTimeout(() => markRead(roomThread.id), 0);
    return () => window.clearTimeout(timer);
  }, [roomThread?.id, markRead]);

  // Browser back/forward changes the route (and with it `activeId`) while the
  // component stays mounted; adopt that as the selection instead of ignoring it.
  // Deferred a tick to satisfy react-hooks/set-state-in-effect.
  React.useEffect(() => {
    const timer = window.setTimeout(() => setSelectedId(activeId ?? null), 0);
    return () => window.clearTimeout(timer);
  }, [activeId]);

  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!roomThread || uploading) return;
    const value = composed[roomThread.id]?.trim();
    if (!value && pending.length === 0) return;
    setUploading(true);
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
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const message: AdminThreadMessage = {
        id: `local-${Date.now()}`,
        from: "staff",
        author: staffName || "Fayfort",
        // Attachment-only replies have no draft text to trim.
        text: value ?? "",
        at: `Today, ${now}`,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
      setExtra((prev) => ({
        ...prev,
        [roomThread.id]: [...(prev[roomThread.id] ?? []), message],
      }));
      setComposed((prev) => ({ ...prev, [roomThread.id]: "" }));
      clearPending();
      markRead(roomThread.id);
      try {
        await onReply(roomThread.id, value ?? "", attachments);
        setExtra((prev) => {
          const next = { ...prev };
          delete next[roomThread.id];
          return next;
        });
        void refreshThreads();
        toast.success("Reply sent to the customer’s portal chat");
      } catch {
        toast.error("Reply failed to send — please try again");
      }
    } finally {
      setUploading(false);
      // A failed batch stays in the composer; only the bars are cleared.
      setUploadProgress({});
    }
  }

  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    const accepted: PendingChatAttachment[] = [];
    for (const file of files) {
      const entry = pendingFromFile(file);
      if (entry) accepted.push(entry);
      else toast.error(`"${file.name}" is not an image or video file.`);
    }
    if (accepted.length > 0) setPending((current) => [...current, ...accepted]);
  };

  const clearPending = () => {
    setPending((current) => {
      for (const entry of current) URL.revokeObjectURL(entry.url);
      return [];
    });
  };

  const insertEmoji = (emoji: string) => {
    if (!roomThread) return;
    setComposed((prev) => ({ ...prev, [roomThread.id]: `${prev[roomThread.id] ?? ""}${emoji}` }));
  };

  if (threads.length === 0) {
    return (
      <div className="border-sand-200 m-4 flex min-h-0 flex-1 items-center justify-center rounded-2xl border bg-white lg:m-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="bg-sand-100 text-sand-500 flex size-12 items-center justify-center rounded-full">
            <MessagesSquare aria-hidden className="size-6" />
          </span>
          <p className="font-display text-sand-900 text-base font-semibold">No conversations yet</p>
          <p className="text-sand-500 max-w-xs text-sm">
            Customer chat threads will appear here the moment they’re opened.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-sand-200 bg-sand-50/60 m-4 flex min-h-0 flex-1 overflow-hidden rounded-2xl border shadow-sm lg:m-5">
      {/* Conversation list */}
      <section
        aria-label="Conversations"
        className={cn(
          "border-sand-200 bg-sand-50/80 flex w-full flex-col border-r md:w-72 md:shrink-0",
          roomThread && "hidden md:flex",
        )}
      >
        <div className="border-sand-200 flex flex-col gap-3 border-b px-5 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-sand-950 text-lg font-semibold tracking-tight">
              Chats
            </h1>
            <span className="bg-sand-900 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
              {threads.length}
            </span>
          </div>
          <label className="relative block">
            <Search
              aria-hidden
              className="text-sand-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className="border-sand-200 text-sand-900 placeholder:text-sand-400 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-full border bg-white py-2 pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
            />
          </label>
        </div>

        <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
          {filtered.map((thread, index) => {
            const last = messagesOfPreview(thread, extra);
            const unread = readIds.has(thread.id) ? 0 : thread.unread;
            const isActive = roomThread?.id === thread.id;
            return (
              <li key={thread.id}>
                <button
                  type="button"
                  aria-label={`Conversation with ${thread.customer}`}
                  onClick={() => selectThread(thread.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                    isActive ? "ring-sand-200 bg-white shadow-sm ring-1" : "hover:bg-sand-100/80",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "font-display flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      AVATAR_TINTS[index % AVATAR_TINTS.length],
                    )}
                  >
                    {initialsOf(thread.customer)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-sm",
                          unread > 0 ? "text-sand-950 font-semibold" : "text-sand-800 font-medium",
                        )}
                      >
                        {thread.customer}
                      </span>
                      <span className="text-sand-400 shrink-0 text-[11px] tabular-nums">
                        {thread.lastActive}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-xs",
                          unread > 0 ? "text-sand-800 font-medium" : "text-sand-500",
                        )}
                      >
                        {last.preview}
                      </span>
                      {unread > 0 ? (
                        <span className="bg-success-500 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white tabular-nums">
                          {unread}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="text-sand-500 px-3 py-8 text-center text-sm">
              No conversations match “{query}”.
            </li>
          ) : null}
        </ul>
      </section>

      {/* Chat room */}
      <section
        aria-label="Chat room"
        className={cn("flex min-w-0 flex-1 flex-col bg-white", !roomThread && "hidden md:flex")}
      >
        {roomThread ? (
          <>
            <header className="border-sand-200 flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  aria-label="Back to conversations"
                  onClick={showList}
                  className="text-sand-500 hover:bg-sand-100 hover:text-sand-900 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors md:hidden"
                >
                  <ArrowLeft aria-hidden className="size-4" />
                </button>
                <span
                  aria-hidden
                  className="bg-brand-100 font-display text-brand-800 flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                >
                  {initialsOf(roomThread.customer)}
                </span>
                <div className="flex min-w-0 flex-col">
                  <p className="text-sand-950 truncate text-sm font-semibold">
                    {roomThread.customer}
                  </p>
                  <p className="text-sand-500 truncate text-xs">
                    {roomThread.ref} · {roomThread.subject}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={roomThread.status} />
                <CallStartButtons
                  peer={roomThread.customer}
                  onStart={call.start}
                  disabled={call.state.phase !== "idle"}
                />
              </div>
            </header>

            <PushNudge className="mx-4 mt-2 mb-1 shrink-0" />

            <ol
              ref={listRef}
              className="bg-sand-50/70 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-5"
            >
              {roomThread.unread > 0 && !readIds.has(roomThread.id) ? (
                <li className="text-success-600 mx-auto flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase">
                  <span className="bg-success-200 h-px w-8" aria-hidden />
                  {roomThread.unread} new message{roomThread.unread > 1 ? "s" : ""}
                  <span className="bg-success-200 h-px w-8" aria-hidden />
                </li>
              ) : null}
              {messages.length === 0 ? (
                <li className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm font-medium text-sand-600">No messages yet</p>
                  <p className="max-w-xs text-xs leading-relaxed text-sand-400">
                    This conversation is empty — send the first reply to get the
                    thread going.
                  </p>
                </li>
              ) : null}
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={cn("flex", message.from === "staff" && "justify-end")}
                >
                  <div
                    className={cn(
                      "flex max-w-[85%] flex-col overflow-hidden rounded-2xl sm:max-w-[70%]",
                      message.from === "staff"
                        ? "bg-brand-700 rounded-br-sm text-white"
                        : "border-sand-200 text-sand-900 rounded-bl-sm border bg-white",
                    )}
                  >
                    {message.attachments && message.attachments.length > 0 ? (
                      <ChatAttachments
                        attachments={message.attachments}
                        // Text brings its own top padding, so only then does the
                        // media need to sit flush above it.
                        className={message.text ? "m-2 mb-0" : "m-2"}
                      />
                    ) : null}
                    {message.text ? (
                      <p className="px-3.5 py-2.5 text-sm leading-relaxed">{message.text}</p>
                    ) : null}
                    <span
                      className={cn(
                        "flex items-center justify-end gap-1 self-end px-3.5 pb-2 text-[10px] tabular-nums",
                        message.from === "staff" ? "text-brand-200" : "text-sand-400",
                      )}
                    >
                      {timeOf(message.at)}
                      {message.from === "staff" ? (
                        <CheckCheck aria-hidden className="size-3" />
                      ) : null}
                    </span>
                  </div>
                </li>
              ))}
              {typingBy[roomThread.id] ? (
                <li className="flex">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-sand-200 bg-white px-3.5 py-2 shadow-sm">
                    <span className="text-sand-600 text-xs">
                      {typingBy[roomThread.id]} is typing
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className="bg-sand-400 size-1.5 animate-pulse rounded-full" />
                      <span className="bg-sand-400 size-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
                      <span className="bg-sand-400 size-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
                    </span>
                  </div>
                </li>
              ) : null}
            </ol>

            <div className="border-sand-200 flex flex-col gap-3 border-t p-3 sm:p-4">
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
                    const sending = percent !== undefined;
                    return (
                      <>
                        {sending ? (
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
                          // Removing mid-flight would orphan the upload.
                          disabled={sending}
                          onClick={() =>
                            setPending((current) => {
                              const removed = current.find((candidate) => candidate.key === entry.key);
                              if (removed) URL.revokeObjectURL(removed.url);
                              return current.filter((candidate) => candidate.key !== entry.key);
                            })
                          }
                          className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-sand-900 text-white shadow-sm transition-opacity hover:bg-sand-950 disabled:pointer-events-none disabled:opacity-40"
                        >
                          <X aria-hidden className="size-3" />
                        </button>
                      </>
                    );
                  }}
                />
              ) : null}
              <form onSubmit={send} className="flex items-center gap-1 rounded-full border border-sand-200 bg-sand-50 p-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 sm:p-1 sm:pr-1.5">
                <EmojiPicker onSelect={insertEmoji} className="size-11 sm:size-10" />
                <button
                  type="button"
                  aria-label="Attach an image or video"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sand-400 hover:bg-sand-100 hover:text-sand-700 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 sm:size-10"
                >
                  <Paperclip aria-hidden className="size-5" />
                </button>
                <input
                  ref={fileInputRef}
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
                <input
                  value={composed[roomThread.id] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setComposed((prev) => ({
                      ...prev,
                      [roomThread.id]: value,
                    }));
                    if (value.trim()) {
                      socketRef.current?.notifyTyping(roomThread.id);
                    }
                  }}
                  placeholder={`Reply to ${roomThread.customer}…`}
                  aria-label="Reply to customer"
                  className="placeholder:text-sand-400 bg-transparent text-sand-900 focus:ring-0 min-w-0 flex-1 rounded-full px-2 py-2 text-sm focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Send reply"
                  disabled={!((composed[roomThread.id] ?? "").trim() || pending.length > 0) || uploading}
                  className="bg-success-600 hover:bg-success-700 disabled:bg-sand-200 disabled:text-sand-400 flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-colors disabled:cursor-not-allowed sm:size-10"
                >
                  <Send aria-hidden className="size-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="bg-sand-100 text-sand-400 flex size-14 items-center justify-center rounded-full">
              <MessagesSquare aria-hidden className="size-7" />
            </span>
            <p className="font-display text-sand-900 text-base font-semibold">
              Select a conversation
            </p>
            <p className="text-sand-500 max-w-xs text-sm">
              Customer chat threads from the portal appear here — pick one on the left to start
              replying.
            </p>
          </div>
        )}
      </section>

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

function messagesOfPreview(
  thread: AdminThread,
  extra: Record<string, AdminThreadMessage[]>,
): { preview: string } {
  const overrides = extra[thread.id] ?? [];
  const last =
    overrides.length > 0
      ? overrides[overrides.length - 1]
      : thread.messages[thread.messages.length - 1];
  const prefix = last.from === "staff" ? "You: " : "";
  // `text` is required by the type but a missing composer key yields undefined at
  // runtime, so attachment-only messages must not assume it is a string.
  const text = last.text ?? "";
  const preview =
    text.trim() || (last.attachments?.length ?? 0) === 0
      ? text
      : attachmentPreviewLabel(last.attachments) ?? "Attachment";
  return { preview: `${prefix}${preview}` };
}
