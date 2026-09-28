import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with deterministic conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number with thousands separators. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** Format a number as a currency string. Use for display only — money math is server-side. */
export function formatMoney(
  value: number,
  currency = "USD",
  opts: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  }).format(value);
}

/** Format a decimal as a percentage, e.g. 0.235 -> "23.5%". */
export function formatPercent(value: number, digits = 1): string {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value * 100)}%`;
}
