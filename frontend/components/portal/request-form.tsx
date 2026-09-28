"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/ui/image-uploader";

const CATEGORIES = [
  "Electronics",
  "Fashion",
  "Footwear",
  "Home & Kitchen",
  "Beauty & Personal Care",
  "Toys & Games",
  "Machinery",
  "Other",
] as const;

const CURRENCIES = ["NGN", "GHS", "USD", "TZS", "KES"] as const;

interface FormState {
  product: string;
  category: string;
  quantity: string;
  budget: string;
  currency: string;
  destination: string;
  contactPhone: string;
  notes: string;
  imageUrls: string[];
}

type FormErrors = Partial<Record<keyof FormState, string>>;

/**
 * Customer-facing "file a sourcing request" form. Attached photos are pushed
 * to Cloudinary first (URL only is sent to the Go backend) so the payload
 * stays plain JSON through the /api/backend proxy.
 */
export function RequestForm() {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>({
    product: "",
    category: "Electronics",
    quantity: "",
    budget: "",
    currency: "NGN",
    destination: "",
    contactPhone: "",
    notes: "",
    imageUrls: [],
  });
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [submitting, setSubmitting] = React.useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!form.product.trim()) next.product = "Tell us what you want to source.";
    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      next.quantity = "Enter a quantity of at least 1 unit.";
    }
    if (form.budget && Number(form.budget) <= 0) {
      next.budget = "Budget must be greater than zero.";
    }
    const phone = form.contactPhone.trim();
    if (!phone) {
      next.contactPhone = "We need a number to reach you about your quote.";
    } else if (!/^\+?[\d\s().-]{7,20}$/.test(phone)) {
      next.contactPhone = "Enter a valid phone or WhatsApp number.";
    }
    return next;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    if (submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/backend/sourcing-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: form.product.trim(),
          category: form.category,
          quantity: Number(form.quantity),
          budget: form.budget ? Number(form.budget) : 0,
          currency: form.currency,
          destination: form.destination.trim(),
          contactPhone: form.contactPhone.trim(),
          notes: form.notes.trim(),
          imageUrls: form.imageUrls,
        }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok: true; request?: { id?: string } }
        | { ok?: undefined; error?: string }
        | null;
      if (!res.ok || !payload || payload.ok !== true) {
        toast.error(
          payload && "error" in payload
            ? payload.error ?? "Could not file the request. Try again."
            : "Could not file the request. Try again.",
        );
        return;
      }
      toast.success("Request filed. Our team is on it.");
      router.push("/overview");
    } catch {
      toast.error("Could not file the request. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6"
      aria-label="File a sourcing request"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Product" required error={errors.product} className="sm:col-span-2">
          <Input
            value={form.product}
            onChange={(event) => set("product", event.target.value)}
            placeholder="e.g. Wireless headphones"
          />
        </Field>
        <Field
          label="Phone / WhatsApp"
          required
          hint="So our team can reach you when your quote lands."
          error={errors.contactPhone}
        >
          <Input
            type="tel"
            value={form.contactPhone}
            onChange={(event) => set("contactPhone", event.target.value)}
            placeholder="e.g. +234 812 345 6789"
            autoComplete="tel"
          />
        </Field>
        <Field label="Destination" hint="City, country">
          <Input
            value={form.destination}
            onChange={(event) => set("destination", event.target.value)}
            placeholder="e.g. Accra, GH"
          />
        </Field>
        <Field label="Budget" hint="Target budget" error={errors.budget}>
          <Input
            type="number"
            min={0}
            step={1000}
            value={form.budget}
            onChange={(event) => set("budget", event.target.value)}
            placeholder="e.g. 3,000,000"
          />
        </Field>
        <Field label="Currency">
          <Select
            value={form.currency}
            onChange={(event) => set("currency", event.target.value)}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantity" required error={errors.quantity}>
          <Input
            type="number"
            min={1}
            step={1}
            value={form.quantity}
            onChange={(event) => set("quantity", event.target.value)}
            placeholder="e.g. 500"
          />
        </Field>
        <Field label="Category">
          <Select
            value={form.category}
            onChange={(event) => set("category", event.target.value)}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea
            rows={4}
            value={form.notes}
            onChange={(event) => set("notes", event.target.value)}
            placeholder="Target price, specs, packaging, deadlines…"
          />
        </Field>
      </div>

      <div className="rounded-xl border border-sand-200 bg-white p-5">
        <ImageUploader
          value={form.imageUrls}
          onChange={(urls) => set("imageUrls", urls)}
          label="Reference photos"
          hint="Photos of the product you have in mind (or similar ones) help the team match specifications."
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" intent="primary" size="lg" loading={submitting}>
          <Paperclip aria-hidden className="size-4" />
          {submitting ? "Filing request…" : "File sourcing request"}
        </Button>
      </div>
    </form>
  );
}