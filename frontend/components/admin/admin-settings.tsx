"use client";

import * as React from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

const OPS_CURRENCIES = ["NGN", "GHS", "TZS", "KES", "USD"];

const OPS_PREFS = [
  {
    key: "quoteAlert",
    label: "Quote alerts",
    hint: "Ping me the moment a customer accepts or declines a quote.",
  },
  {
    key: "dailyDigest",
    label: "Daily digest",
    hint: "A 9am summary of new requests, quote deadlines and support queries.",
  },
  {
    key: "riskFlag",
    label: "Risk flags",
    hint: "Notify me when a customer account enters the “at risk” state.",
  },
] as const;

export function AdminSettingsPanel() {
  const [currency, setCurrency] = React.useState("NGN");
  const [referenceFx, setReferenceFx] = React.useState("1580");
  const [prefs, setPrefs] = React.useState<Record<string, boolean>>({
    quoteAlert: true,
    dailyDigest: false,
    riskFlag: true,
  });

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast.success("Ops preferences saved");
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-sand-950">
          Console settings
        </h1>
        <p className="text-sm text-sand-500">
          Staff console defaults — quote pricing, notification behaviour and
          the operational reference rate.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pricing defaults</CardTitle>
          <CardDescription>
            Used when quotes are drafted and the reference FX is applied.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:max-w-2xl">
            <Field label="Working currency">
              <Select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                {OPS_CURRENCIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reference FX (₦ per $)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                value={referenceFx}
                onChange={(event) => setReferenceFx(event.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Choose which staff alerts land in this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-sand-200 lg:max-w-2xl">
            {OPS_PREFS.map((pref) => (
              <li key={pref.key} className="flex items-start gap-3 px-1 py-4 first:pt-0 last:pb-0">
                <span className="pt-0.5">
                  <Checkbox
                    id={pref.key}
                    checked={prefs[pref.key]}
                    onCheckedChange={(checked) =>
                      setPrefs((prev) => ({ ...prev, [pref.key]: checked }))
                    }
                  />
                </span>
                <label htmlFor={pref.key} className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium text-sand-900">{pref.label}</span>
                  <span className="text-sm text-sand-500">{pref.hint}</span>
                </label>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit" intent="neutral" size="lg">
          <BellRing aria-hidden className="size-4" />
          Save settings
        </Button>
      </div>
    </form>
  );
}