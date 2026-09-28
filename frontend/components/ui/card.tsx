import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn("border-sand-200 shadow-card rounded-xl border bg-white", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentPropsWithRef<"div">) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentPropsWithRef<"h3">) {
  return (
    <h3
      className={cn("font-display text-sand-900 text-base font-semibold", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.ComponentPropsWithRef<"p">) {
  return <p className={cn("text-sand-500 text-sm", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentPropsWithRef<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentPropsWithRef<"div">) {
  return <div className={cn("flex items-center gap-3 p-5 pt-0", className)} {...props} />;
}
