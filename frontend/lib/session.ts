import { getSession } from "@/lib/backend";
import type { MockSession } from "@/lib/auth";

/**
 * Server-side session reader. Validates the opaque `fayfort_session` token
 * against the Go backend's /api/me (cached per render). Returns null when the
 * token is missing or invalid.
 */
export { getSession };
export type { MockSession };