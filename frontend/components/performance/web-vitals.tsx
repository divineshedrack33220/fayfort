"use client";

import { useReportWebVitals } from "next/web-vitals";

const VITAL_NAMES = ["FCP", "LCP", "CLS", "FID", "TTFB", "INP"] as const;

/**
 * Surfaces Core Web Vitals in the console during development and prepares a
 * spot to POST them at launch. In production you can swap the console
 * logging for a call to your analytics collector, e.g. `/api/health/vitals`.
 */
export function VitalsMonitor() {
  useReportWebVitals((metric) => {
    if (!VITAL_NAMES.includes(metric.name as (typeof VITAL_NAMES)[number])) return;

    if (process.env.NODE_ENV !== "production") {
      console.info(`[vitals] ${metric.name}: ${metric.value.toFixed(1)} (${metric.rating})`);
      return;
    }

    // Launch point: forward to an analytics collector, e.g.
    //   fetch("/api/health/vitals", { method: "POST", body: JSON.stringify(metric) })
  });

  return null;
}