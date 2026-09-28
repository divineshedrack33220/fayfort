import * as React from "react";
import { cn } from "@/lib/utils";

/** Wraps the table in a horizontal-scroll container for small screens. */
export function TableContainer({ className, ...props }: React.ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn(
        "border-sand-200 shadow-card w-full overflow-x-auto rounded-xl border bg-white",
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.ComponentPropsWithRef<"table">) {
  return (
    <table
      className={cn("w-full min-w-[32rem] border-collapse text-left text-sm", className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ComponentPropsWithRef<"thead">) {
  return <thead className={cn("border-sand-200 border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentPropsWithRef<"tbody">) {
  return <tbody className={cn("divide-sand-100 divide-y", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentPropsWithRef<"tr">) {
  return <tr className={cn("hover:bg-sand-50 transition-colors", className)} {...props} />;
}

export function TableHeadCell({ className, ...props }: React.ComponentPropsWithRef<"th">) {
  return (
    <th
      className={cn(
        "text-sand-500 px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentPropsWithRef<"td">) {
  return <td className={cn("text-sand-800 px-4 py-3 align-middle", className)} {...props} />;
}
