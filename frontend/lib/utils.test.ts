import { describe, expect, it } from "vitest";
import { cn, formatMoney, formatNumber, formatPercent } from "@/lib/utils";

describe("cn", () => {
  it("joins strings and drops falsy values", () => {
    expect(cn("a", false, "b", undefined, "c")).toBe("a b c");
  });

  it("resolves tailwind conflicts with tailwind-merge", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("bg-brand-500", "bg-brand-700")).toBe("bg-brand-700");
  });

  it("merges nested class arrays", () => {
    expect(cn(["a", "b"])).toBe("a b");
  });
});

describe("formatNumber", () => {
  it("formats with thousands separators", () => {
    expect(formatNumber(18420)).toBe("18,420");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});

describe("formatMoney", () => {
  it("formats a currency amount", () => {
    expect(formatMoney(18420)).toBe("$18,420.00");
    expect(formatMoney(4.24, "USD")).toBe("$4.24");
  });

  it("supports non-USD currencies", () => {
    expect(formatMoney(120, "CNY")).toContain("CN¥");
  });
});

describe("formatPercent", () => {
  it("formats decimals as percentages", () => {
    expect(formatPercent(0.214)).toBe("21.4%");
    expect(formatPercent(0.5, 0)).toBe("50%");
  });
});
