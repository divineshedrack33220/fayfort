import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Go backend client, used server-side by pages, server actions and API
 * handlers. The backend base URL is configurable so the service can run on
 * any port/box; the default matches `backend/run.sh`.
 */
export const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8080";

export const SESSION_COOKIE_NAME = "fayfort_session";

export class BackendError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

/**
 * Upper bound for a single backend call. Without it a backend that accepts the
 * connection but stalls (e.g. mid-restart) hangs the server render forever,
 * which strands the page and lets the dev server reset the RSC stream.
 */
const BACKEND_TIMEOUT_MS = 10000;

async function rawBackend(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE_NAME)?.value;
  const extra: string[] = [];
  if (cookie) extra.push(`${SESSION_COOKIE_NAME}=${cookie}`);
  const existing = headers.get("cookie");
  if (existing) extra.push(existing);
  if (extra.length) headers.set("cookie", extra.join("; "));
  headers.set("Accept", "application/json");

  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(BACKEND_TIMEOUT_MS),
  });
}

/**
 * Typed backend call. Throws BackendError on non-2xx so callers can render
 * an error/empty state; returns the JSON body for 2xx.
 */
export async function backend<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await rawBackend(path, init);
  if (!res.ok) {
    let message = `Backend request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep the generic message
    }
    throw new BackendError(res.status, message);
  }
  return (await res.json()) as T;
}

/** Backend call that returns null instead of throwing (for soft fallbacks). */
export async function backendOrNull<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    return await backend<T>(path, init);
  } catch {
    return null;
  }
}

export function backendQuery(path: string, params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Raw fetch that also returns the Set-Cookie headers (used by the auth
 * handlers to relay the backend's session cookie to the browser).
 */
export async function backendWithCookies(path: string, init?: RequestInit): Promise<Response> {
  return rawBackend(path, init);
}

/**
 * The authenticated context for the current request, cached so every page
 * render only pays one round-trip to the backend. Shape mirrors MockSession
 * so existing `session.name` / `session.role` consumers keep working.
 */
export const getSession = cache(async (): Promise<
  {
    email: string;
    name?: string;
    signedInAt: string;
    role?: "customer" | "admin";
    avatarUrl?: string;
  } | null
> => {
  try {
    const me = await backend<{
      ok: boolean;
      user: { id: string; name: string; email: string; role?: string; avatarUrl?: string };
    }>("/api/me", { method: "GET" });
    return {
      email: me.user.email,
      name: me.user.name,
      signedInAt: new Date().toISOString(),
      role: me.user.role === "admin" ? "admin" : "customer",
      avatarUrl: me.user.avatarUrl,
    };
  } catch {
    return null;
  }
});