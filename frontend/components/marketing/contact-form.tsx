"use client";

import * as React from "react";
import { MailCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * Contact form wired to the backend /api/contact endpoint. Opts into the
 * same-origin proxy so it works whether the backend is co-deployed or remote.
 */
export function ContactForm() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const valid =
    name.trim() !== "" && email.trim() !== "" && message.trim() !== "";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/backend/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Your message couldn’t be sent. Try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Your message couldn’t be sent. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <Alert tone="success" title="Message sent">
        Thanks, {name.trim() || "friend"} — your message reached the Fayfort
        team at {email.trim()}
        {whatsapp.trim()
          ? `, and your WhatsApp number (${whatsapp.trim()}) is a second way to reach you.`
          : ", and they’ll get back to you shortly."}
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Your name" required>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Ama Mensah"
          autoComplete="name"
        />
      </Field>
      <Field label="Email" required>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </Field>
      <Field label="WhatsApp number" hint="Optional — a second way to reach you">
        <Input
          type="tel"
          inputMode="tel"
          value={whatsapp}
          onChange={(event) => setWhatsapp(event.target.value)}
          placeholder="e.g. +234 801 234 5678"
          autoComplete="tel"
        />
      </Field>
      <Field label="Message" required>
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="What are you sourcing, and how can we help?"
          rows={5}
        />
      </Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex items-center gap-3">
        <Button type="submit" intent="accent" disabled={!valid || busy} loading={busy}>
          <MailCheck aria-hidden className="size-4" />
          Send message
        </Button>
      </div>
    </form>
  );
}