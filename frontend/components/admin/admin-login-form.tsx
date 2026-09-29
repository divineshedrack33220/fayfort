"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldHalf } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isAcceptablePassword, isEmail } from "@/lib/auth";

export interface AdminLoginFormProps {
  next: string;
}

type LoginResponse = {
  ok?: boolean;
  error?: string;
  user?: { id?: string; name?: string; email?: string; role?: string; status?: string };
};

export function AdminLoginForm({ next }: AdminLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const emailOk = isEmail(email);
  const passwordOk = isAcceptablePassword(password);
  const valid = emailOk && passwordOk;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/backend/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await response.json()) as LoginResponse;
      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      if (data.user?.role !== "admin") {
        setError("This account doesn’t have staff access. Use the staff sign-in instead.");
        return;
      }
      router.push(next);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Staff email" required>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@fayfort.com"
          autoComplete="email"
          invalid={email.length > 0 && !emailOk}
        />
      </Field>

      <Field label="Password" required>
        <span className="relative block">
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            invalid={password.length > 0 && !passwordOk}
            className="w-full pr-10"
          />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-sand-400 transition-colors hover:text-sand-700"
          >
            {showPassword ? (
              <EyeOff aria-hidden className="size-4" />
            ) : (
              <Eye aria-hidden className="size-4" />
            )}
          </button>
        </span>
      </Field>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Button type="submit" intent="primary" size="lg" loading={busy} disabled={!valid} className="mt-1">
        <ShieldHalf aria-hidden className="size-4" />
        Sign in to staff console
      </Button>
    </form>
  );
}