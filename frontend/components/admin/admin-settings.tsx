"use client";

import * as React from "react";
import { BellRing, Database, RotateCcw } from "lucide-react";
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

async function demoAction(path: string, success: string) {
  try {
    const res = await fetch(path, { method: "POST" });
    const payload = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success(success);
      return true;
    }
    toast.error(typeof payload.error === "string" ? payload.error : "Request failed");
  } catch {
    toast.error("Network error — try again.");
  }
  return false;
}

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
        <h1 className="font-display text-sand-950 text-2xl font-semibold tracking-tight">
          Console settings
        </h1>
        <p className="text-sand-500 text-sm">
          Staff console defaults — quote pricing, notification behaviour and the operational
          reference rate.
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
          <CardDescription>Choose which staff alerts land in this account.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-sand-200 flex flex-col divide-y lg:max-w-2xl">
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
                  <span className="text-sand-900 text-sm font-medium">{pref.label}</span>
                  <span className="text-sand-500 text-sm">{pref.hint}</span>
                </label>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demo data</CardTitle>
          <CardDescription>
            Real records are kept unless you ask for the reference dataset. “Load demo data” adds it
            on top of what exists; “Reset” wipes all customers, requests, quotes, orders, shipments,
            threads and notifications (accounts stay intact).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              intent="primary"
              onClick={async () => {
                if (await demoAction("/api/backend/admin/demo/load", "Demo data loaded")) {
                  toast.info("The reference dataset is now visible in the console.");
                }
              }}
            >
              <Database aria-hidden className="size-4" />
              Load demo data
            </Button>
            <Button
              intent="danger"
              onClick={() => {
                if (
                  window.confirm(
                    "Reset ALL real data (customers, requests, quotes, orders, shipments, threads and notifications)? Accounts stay signed in. This cannot be undone.",
                  )
                ) {
                  void demoAction(
                    "/api/backend/admin/demo/reset?seed=true",
                    "Data reset — demo dataset reloaded",
                  );
                }
              }}
            >
              <RotateCcw aria-hidden className="size-4" />
              Reset all data &amp; reseed demo
            </Button>
          </div>
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
