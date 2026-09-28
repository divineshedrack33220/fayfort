import "@testing-library/jest-dom/vitest";

// Radix primitives (dialog, popper) touch these APIs in jsdom.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: ResizeObserverStub,
    writable: true,
    configurable: true,
  });
}

if (!("scrollTo" in window)) {
  Object.defineProperty(window, "scrollTo", {
    value: () => {},
    writable: true,
  });
}

// jsdom cannot mint object URLs from a File (it throws on the internal Blob
// buffer), but the chat composers create one per picked attachment for the
// preview. Tests stub or rely on this no-op.
if (typeof URL.createObjectURL !== "function") {
  Object.defineProperty(URL, "createObjectURL", {
    value: () => "blob:preview",
    writable: true,
    configurable: true,
  });
} else {
  const original = URL.createObjectURL.bind(URL);
  let counter = 0;
  Object.defineProperty(URL, "createObjectURL", {
    value: (object: Blob | MediaSource) => {
      try {
        return original(object);
      } catch {
        counter += 1;
        return `blob:preview-${counter}`;
      }
    },
    writable: true,
    configurable: true,
  });
}