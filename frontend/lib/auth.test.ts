import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession } from "@/lib/auth";

describe("session encoding", () => {
  it("round-trips a session through cookie encoding", () => {
    const session = { email: "ama@example.com", signedInAt: "2026-09-22T00:00:00Z" };
    const raw = encodeSession(session);
    const decoded = decodeSession(raw);
    expect(decoded).toEqual({
      email: "ama@example.com",
      signedInAt: "2026-09-22T00:00:00Z",
      role: "customer",
    });
  });

  it("round-trips a staff session's role", () => {
    const session = {
      email: "admin@fayfort.com",
      name: "Ada",
      role: "admin" as const,
      signedInAt: "2026-09-22T00:00:00Z",
    };
    expect(decodeSession(encodeSession(session))).toEqual(session);
  });

  it("keeps an optional name", () => {
    const session = { email: "ama@example.com", name: "Ama", signedInAt: "x" };
    expect(decodeSession(encodeSession(session))?.name).toBe("Ama");
  });

  it("returns null for garbage", () => {
    expect(decodeSession("not-a-cookie")).toBeNull();
    expect(decodeSession("")).toBeNull();
  });

  it("rejects payloads without a valid email", () => {
    const bad = btoa(encodeURIComponent(JSON.stringify({ email: "nope" })));
    expect(decodeSession(bad)).toBeNull();
  });
});