/**
 * Site-wide configuration. The app is production-ready by default; set
 * `NEXT_PUBLIC_IS_DEMO` to "true" only if you want the demo-only helpers
 * (sample notices and developer shortcuts) switched on for testing.
 */
export const IS_DEMO = process.env.NEXT_PUBLIC_IS_DEMO === "true";

export const SITE_NAME = "Fayfort Sourcing";
export const SITE_DESCRIPTION =
  "China-to-Africa sourcing with transparent landed costs. Estimate, request, quote and track your shipments.";
export const SITE_URL = "https://fayfort.com";