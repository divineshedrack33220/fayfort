"use client";

import { SlidersHorizontal } from "lucide-react";

export interface FilterSelectOption {
  value: string;
  label: string;
}

export function FilterSelect({
  label,
  value,
  paramName,
  options,
}: {
  label: string;
  value: string;
  paramName: string;
  options: FilterSelectOption[];
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sand-500">
        <SlidersHorizontal aria-hidden className="size-3.5" />
        {label}
      </span>
      <select
        name={paramName}
        defaultValue={value}
        aria-label={`${label} filter`}
        onChange={(event) => {
          const current = new URL(window.location.href);
          if (event.target.value === "any" || event.target.value === "newest") {
            current.searchParams.delete(paramName);
          } else {
            current.searchParams.set(paramName, event.target.value);
          }
          window.location.href = current.toString();
        }}
        className="h-9 rounded-md border border-sand-300 bg-white px-2.5 text-sm text-sand-700 shadow-sm focus:ring-2 focus:ring-sand-400 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  );
}