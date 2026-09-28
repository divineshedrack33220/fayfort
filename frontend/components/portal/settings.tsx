"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

const CURRENCIES = ["USD", "EUR", "GBP", "CNY", "NGN"];
const DESTINATIONS = ["Nigeria — Lagos", "Nigeria — Abuja", "Nigeria — Port Harcourt", "Ghana — Accra"];

const NOTIFICATION_PREFS = [
  { id: "notif-status", label: "Status updates", description: "When a request moves to a new stage." },
  { id: "notif-quotes", label: "Quote alerts", description: "When a new quote is ready to review." },
  { id: "notif-shipping", label: "Shipping milestones", description: "Tracking events while your order ships." },
  { id: "notif-digest", label: "Weekly digest", description: "A short summary of everything in progress." },
];

export function SettingsPanel() {
  const [currency, setCurrency] = useState("USD");
  const [destination, setDestination] = useState(DESTINATIONS[0]);
  const [referenceFx, setReferenceFx] = useState("1500");
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_PREFS.map((pref) => [pref.id, true])),
  );

  const togglePref = (id: string) =>
    setPrefs((prev) => ({ ...prev, [id]: !prev[id] }));

  const save = () => {
    toast.success("Settings saved");
  };

  return (
    <div className="container-shell flex flex-col gap-6 py-8 sm:py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">
            Settings
          </h1>
          <p className="text-sm text-sand-500 sm:text-base">
            Your workflow defaults — used when a new estimate or request is
            created.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-6 p-5 sm:p-6">
          <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Default currency">
              <Select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                {CURRENCIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Default destination">
              <Select
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              >
                {DESTINATIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reference FX">
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
        <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <p className="font-display text-base font-semibold text-brand-900">
              Notification preferences
            </p>
            <p className="text-sm text-sand-500">
              Choose how the Fayfort team keeps you posted.
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-sand-100">
            {NOTIFICATION_PREFS.map((pref) => (
              <li
                key={pref.id}
                className="flex items-start justify-between gap-4 py-3.5"
              >
                <label htmlFor={pref.id} className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-brand-900">
                    {pref.label}
                  </span>
                  <span className="text-sm text-sand-500">
                    {pref.description}
                  </span>
                </label>
                <Checkbox
                  id={pref.id}
                  checked={prefs[pref.id]}
                  onCheckedChange={() => togglePref(pref.id)}
                  aria-label={pref.label}
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button intent="accent" onClick={save}>
          <Save aria-hidden className="size-4" />
          Save settings
        </Button>
      </div>
    </div>
  );
}