/**
 * Search entry shape used by the admin command palette.
 *
 * Results are queried live from the Go backend (see lib/data/admin.ts ->
 * /api/admin/search); this module only defines the shared shape so the
 * modal stays decoupled from legacy fixture data.
 */

export type SearchEntryKind =
  | "Customers"
  | "Requests"
  | "Orders"
  | "Quotes"
  | "Shipments";

export interface SearchEntry {
  kind: SearchEntryKind;
  title: string;
  subtitle: string;
  href: string;
}