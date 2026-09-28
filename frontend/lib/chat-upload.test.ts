import { describe, expect, it, vi } from "vitest";
import { pendingFromFile, uploadChatFileWithProgress } from "@/lib/chat-upload";

/** Minimal XMLHttpRequest stand-in; jsdom does not implement upload progress. */
class FakeXHR {
  static last: FakeXHR | null = null;
  status = 200;
  responseText = JSON.stringify({ ok: true, url: "https://cdn.example.com/x.png" });
  aborted = false;
  /** XHR's `upload` is itself an event target, so it needs its own addEventListener. */
  upload = {
    listeners: {} as Record<string, Array<(e: unknown) => void>>,
    addEventListener(type: string, fn: (e: unknown) => void) {
      (this.listeners[type] ??= []).push(fn);
    },
  };
  listeners = {} as Record<string, Array<() => void>>;

  constructor() {
    FakeXHR.last = this;
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    (this.listeners[type] ??= []).push(fn as () => void);
  }
  open() {}
  /** The test drives `emit("load")` explicitly so ordering is deterministic. */
  send() {}
  abort() {
    this.aborted = true;
  }
  emitProgress(loaded: number, total: number) {
    for (const fn of this.upload.listeners.progress ?? []) {
      fn({ lengthComputable: true, loaded, total });
    }
  }
  emit(type: string) {
    for (const fn of this.listeners[type] ?? []) fn();
  }
}

function withFakeXHR<T>(fn: () => Promise<T>): Promise<T> {
  const original = globalThis.XMLHttpRequest;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).XMLHttpRequest = FakeXHR;
  return fn().finally(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).XMLHttpRequest = original;
  });
}

const file = (name: string, size: number, type = "image/png") => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("uploadChatFileWithProgress", () => {
  it("rejects an oversized image before touching the network", async () => {
    const result = await uploadChatFileWithProgress(file("big.png", 6 * 1024 * 1024), "image");
    expect(result).toEqual({ ok: false, error: "big.png is larger than 5 MB." });
  });

  it("rejects an oversized video with the video limit", async () => {
    const result = await uploadChatFileWithProgress(
      file("big.mp4", 26 * 1024 * 1024, "video/mp4"),
      "video",
    );
    expect(result).toEqual({ ok: false, error: "big.mp4 is larger than 25 MB." });
  });

  it("reports intermediate percentages and finishes at 100", async () => {
    const seen: number[] = [];
    const promise = withFakeXHR(() =>
      uploadChatFileWithProgress(file("a.png", 1000), "image", (p) => seen.push(p)),
    );
    const xhr = FakeXHR.last!;
    // Emit a couple of ticks, then let the response land.
    xhr.emitProgress(400, 1000);
    xhr.emitProgress(900, 1000);
    xhr.emit("load");
    const result = await promise;

    expect(result).toEqual({ ok: true, attachment: { url: "https://cdn.example.com/x.png", kind: "image" } });
    expect(seen).toContain(40);
    expect(seen).toContain(90);
    expect(seen[seen.length - 1]).toBe(100);
  });

  it("never reports 100 before the server responds", async () => {
    const seen: number[] = [];
    const promise = withFakeXHR(() =>
      uploadChatFileWithProgress(file("a.png", 1000), "image", (p) => seen.push(p)),
    );
    const xhr = FakeXHR.last!;
    xhr.emitProgress(1000, 1000);
    expect(seen).toEqual([99]);
    xhr.emit("load");
    await promise;
    expect(seen[seen.length - 1]).toBe(100);
  });

  it("ignores progress events with an unknown total", async () => {
    const seen: number[] = [];
    const promise = withFakeXHR(() =>
      uploadChatFileWithProgress(file("a.png", 1000), "image", (p) => seen.push(p)),
    );
    const xhr = FakeXHR.last!;
    for (const fn of xhr.upload.listeners.progress ?? []) {
      fn({ lengthComputable: false, loaded: 10, total: 0 });
    }
    xhr.emit("load");
    await promise;
    expect(seen).not.toContain(NaN);
    expect(seen.every((n) => Number.isFinite(n))).toBe(true);
  });

  it("surfaces a network error and aborts the request", async () => {
    const promise = withFakeXHR(() => uploadChatFileWithProgress(file("a.png", 100), "image"));
    const xhr = FakeXHR.last!;
    xhr.emit("error");
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(xhr.aborted).toBe(true);
  });

  it("reports a non-JSON error body without throwing", async () => {
    const promise = withFakeXHR(() => uploadChatFileWithProgress(file("a.png", 100), "image"));
    const xhr = FakeXHR.last!;
    xhr.status = 500;
    xhr.responseText = "<html>gateway</html>";
    xhr.emit("load");
    const result = await promise;
    expect(result).toEqual({ ok: false, error: "Upload failed. Try again." });
  });

  it("uses the server error message when present", async () => {
    const promise = withFakeXHR(() => uploadChatFileWithProgress(file("a.png", 100), "image"));
    const xhr = FakeXHR.last!;
    xhr.status = 413;
    xhr.responseText = JSON.stringify({ error: "Image must be 5 MB or smaller." });
    xhr.emit("load");
    expect(await promise).toEqual({ ok: false, error: "Image must be 5 MB or smaller." });
  });

  it("works without a progress callback", async () => {
    const promise = withFakeXHR(() => uploadChatFileWithProgress(file("a.png", 100), "image"));
    FakeXHR.last!.emit("load");
    const result = await promise;
    expect(result.ok).toBe(true);
  });
});

describe("pendingFromFile", () => {
  it("classifies images and videos, rejecting anything else", () => {
    const spy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    expect(pendingFromFile(file("a.png", 10))?.kind).toBe("image");
    expect(pendingFromFile(file("a.mp4", 10, "video/mp4"))?.kind).toBe("video");
    expect(pendingFromFile(file("a.pdf", 10, "application/pdf"))).toBeNull();
    spy.mockRestore();
  });

  it("creates a preview object url and a unique key", () => {
    const spy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    const a = pendingFromFile(file("a.png", 10))!;
    const b = pendingFromFile(file("a.png", 10))!;
    expect(a.url).toBe("blob:preview");
    expect(a.key).not.toBe(b.key);
    spy.mockRestore();
  });
});
