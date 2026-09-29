/**
 * Authentication boundary.
 *
 * CURRENT STATE: the Go backend owns credentials (argon2id + users table).
 * Login/mutation calls go through the /api/backend/* proxy and the session
 * cookie is an opaque token issued by the backend. These helpers keep only
 * client-side shape validation.
 */

export const SESSION_COOKIE = "fayfort_session";

/** Session shape handed to UI (server-validated via /api/me). */
export interface MockSession {
  email: string;
  name?: string;
  signedInAt: string;
  /** Staff console access. Customer sessions omit this. */
  role?: "customer" | "admin";
  /** Google profile picture URL, when the customer signed in with Google. */
  avatarUrl?: string;
}

export function encodeSession(session: MockSession): string {
  return btoa(encodeURIComponent(JSON.stringify(session)));
}

export function decodeSession(raw: string): MockSession | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(raw))) as MockSession;
    if (typeof parsed.email !== "string" || !parsed.email.includes("@")) {
      return null;
    }
    const role = parsed.role === "admin" ? "admin" : "customer";
    return {
      email: parsed.email,
      name: parsed.name,
      signedInAt: parsed.signedInAt,
      role,
      avatarUrl: typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : undefined,
    };
  } catch {
    return null;
  }
}

export function isAdmin(session: MockSession | null): session is MockSession & {
  role: "admin";
} {
  return session?.role === "admin";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Client-side password shape check; the backend enforces full policy. */
export function isAcceptablePassword(value: string): boolean {
  return value.length >= 8;
}