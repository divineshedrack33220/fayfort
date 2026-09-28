"use client";

import * as React from "react";
import Link from "next/link";
import { CornerDownLeft, Search, SearchX } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type SearchEntry } from "@/lib/admin-search";
import { cn } from "@/lib/utils";

export const GLOBAL_SEARCH_ORDER = [
  "Customers",
  "Requests",
  "Orders",
  "Quotes",
  "Shipments",
] as const;

type SearchResult = SearchEntry & { kind: SearchEntry["kind"] };

/**
 * Global command-palette search. Queries the backend /api/admin/search for
 * each query (debounced) so results always reflect live data.
 */
export function GlobalSearchModal() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const needle = query.trim();
    if (!open || needle === "") return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setBusy(true);
      try {
        const response = await fetch(
          `/api/backend/admin/search?q=${encodeURIComponent(needle)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { results?: SearchResult[] };
        if (!cancelled) setResults(payload.results ?? []);
      } catch {
        // backend unreachable — keep the previous results
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  const hits = GLOBAL_SEARCH_ORDER.map((kind) => ({
    kind,
    items: results
      .filter((entry) => entry.kind === kind)
      .slice(0, 5),
  })).filter((group) => group.items.length > 0);

  const total = hits.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setResults([]);
          setOpen(true);
        }}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-sand-300 bg-white px-3 text-sm text-sand-400 shadow-sm transition-colors hover:border-sand-400 hover:text-sand-600 lg:w-64"
        aria-label="Search everything"
      >
        <Search aria-hidden className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden rounded border border-sand-200 bg-sand-50 px-1.5 py-0.5 text-[10px] font-medium text-sand-500 sm:inline">
          /
        </kbd>
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title={undefined}
        hideCloseIcon
      >
        <div className="flex items-center gap-3 border-b border-sand-200 px-5 py-3">
          <Search aria-hidden className="size-4 shrink-0 text-sand-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customers, requests, orders, quotes, shipments…"
            className="border-0 bg-transparent px-0 shadow-none ring-0"
            aria-label="Search everything"
            autoFocus
          />
          {busy ? (
            <span className="size-3 animate-spin rounded-full border-2 border-sand-300 border-t-sand-600" />
          ) : null}
          <kbd className="hidden rounded border border-sand-200 bg-sand-50 px-1.5 py-0.5 text-[10px] font-medium text-sand-500 sm:inline">
            esc
          </kbd>
        </div>

        <div className="max-h-[60dvh] overflow-y-auto px-2 py-3">
          {query.trim() === "" ? (
            <p className="px-3 py-8 text-center text-sm text-sand-500">
                Type to search across the whole operation — requests, orders,
                customers, quotes and shipments.
              </p>
          ) : total === 0 && !busy ? (
            <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
              <SearchX aria-hidden className="size-6 text-sand-300" />
              <p className="text-sm font-medium text-sand-700">No results</p>
              <p className="text-sm text-sand-500">
                Nothing matches “{query}”. Try a customer name, id or product.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {hits.map((group) => (
                <div key={group.kind}>
                  <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-sand-400 uppercase">
                    {group.kind}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {group.items.map((entry) => (
                      <li key={`${entry.kind}-${entry.href}`}>
                        <Link
                          href={entry.href}
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sand-100"
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate font-medium text-sand-900">
                              {entry.title}
                            </span>
                            <span className="truncate text-sand-500">{entry.subtitle}</span>
                          </span>
                          <span
                            aria-hidden
                            className={cn("shrink-0 text-sand-300")}
                          >
                            <CornerDownLeft className="size-3.5" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}