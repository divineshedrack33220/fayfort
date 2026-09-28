"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export interface LogoutButtonProps
  extends Omit<React.ComponentPropsWithRef<"button">, "type"> {
  label?: string;
  ariaLabel?: string;
  iconOnly?: boolean;
  /** Where to navigate after the session is cleared. Defaults to the marketing home. */
  destination?: string;
}

/**
 * Log out button backed by a confirmation dialog. Performs the logout POST
 * then navigates to the configured destination, so accidental taps never end
 * a session.
 */
export const LogoutButton = React.forwardRef<HTMLButtonElement, LogoutButtonProps>(
  function LogoutButton(
    {
      label = "Log out",
      ariaLabel,
      iconOnly = false,
      destination = "/",
      className,
      onClick,
      ...props
    },
    ref,
  ) {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    const confirm = async () => {
      setLoading(true);
      try {
        await fetch("/api/backend/auth/logout", {
          method: "POST",
          credentials: "same-origin",
        });
        router.push(destination);
      } catch {
        setLoading(false);
        setOpen(false);
      }
    };

    return (
      <>
        <button
          ref={ref}
          type="button"
          aria-label={ariaLabel ?? label}
          className={className}
          onClick={(event) => {
            onClick?.(event);
            setOpen(true);
          }}
          {...props}
        >
          {props.children}
          {!iconOnly ? <span>{label}</span> : null}
        </button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Log out of Fayfort?"
          description="You’ll need to sign in again to reach your requests, quotes and chat."
          confirmLabel={label}
          loading={loading}
          onConfirm={() => void confirm()}
        />
      </>
    );
  },
);