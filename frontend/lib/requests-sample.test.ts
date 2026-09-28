import { describe, expect, it } from "vitest";
import {
  assertSampleStatuses,
  SAMPLE_REQUESTS,
  timelineFromStatus,
} from "@/lib/requests-sample";

describe("requests-sample", () => {
  it("has unique request ids", () => {
    const ids = SAMPLE_REQUESTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses statuses from the real vocabulary", () => {
    expect(() => assertSampleStatuses(SAMPLE_REQUESTS)).not.toThrow();
  });

  it("has the five sample requests from the spec", () => {
    expect(SAMPLE_REQUESTS).toHaveLength(5);
    const products = SAMPLE_REQUESTS.map((r) => r.product);
    expect(products).toEqual([
      "Wireless Headphones",
      "Handbags",
      "Sneakers",
      "Smart Watches",
      "Men’s T-Shirts",
    ]);
  });

  it("matches the filter counts in the spec", () => {
    const countFor = (status: string) =>
      SAMPLE_REQUESTS.filter((r) => r.status === status).length;

    expect(SAMPLE_REQUESTS.length).toBe(5);
    expect(countFor("UNDER_REVIEW")).toBe(1);
    expect(countFor("QUOTE_READY")).toBe(1);
    expect(countFor("CONVERTED")).toBe(2);
  });

  it("collapses early statuses onto the correct progress step", () => {
    expect(timelineFromStatus("SUPPLIER_SEARCH")).toEqual([
      { label: "Submitted", state: "done" },
      { label: "Quote", state: "active" },
      { label: "Approved", state: "pending" },
      { label: "Shipped", state: "pending" },
    ]);
  });

  it("marks an approved request as fully progressed to shipped", () => {
    expect(timelineFromStatus("COMPLETED")).toEqual([
      { label: "Submitted", state: "done" },
      { label: "Quote", state: "done" },
      { label: "Approved", state: "done" },
      { label: "Shipped", state: "done" },
    ]);
  });

  it("treats CLOSED as a terminal stage", () => {
    expect(timelineFromStatus("CLOSED").every((s) => s.state === "done")).toBe(
      true,
    );
  });
});