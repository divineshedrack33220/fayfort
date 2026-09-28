"use client";

import {
  ArrowRight,
  CalendarDays,
  Copy,
  Image as ImageIcon,
  Mail,
  Plus,
  Upload,
  Wallet,
} from "lucide-react";
import * as React from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeadCell,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex min-w-0 flex-col gap-5 py-12">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-sand-900 text-xl font-semibold">{title}</h2>
        {description ? <p className="text-sand-500 max-w-2xl text-sm">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DemoPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-sand-200 shadow-card flex flex-wrap items-start gap-4 rounded-xl border bg-white p-6">
      {children}
    </div>
  );
}

const requestStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "SUPPLIER_SEARCH",
  "QUOTE_READY",
  "CUSTOMER_APPROVAL",
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

const quoteStatuses = ["DRAFT", "SENT", "PENDING", "APPROVED", "DECLINED", "EXPIRED"] as const;

const swatches = [
  { name: "brand", shades: ["50", "100", "500", "600", "700", "900"] },
  { name: "accent", shades: ["50", "100", "300", "400", "500", "700"] },
  { name: "sand", shades: ["50", "100", "200", "300", "400", "700", "900"] },
  { name: "success", shades: ["50", "100", "500", "600", "700"] },
  { name: "warning", shades: ["50", "100", "400", "500", "700"] },
  { name: "danger", shades: ["50", "100", "400", "500", "700"] },
  { name: "info", shades: ["50", "100", "400", "500", "700"] },
] as const;

export default function DesignGalleryPage() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmLoading, setConfirmLoading] = React.useState(false);

  const runConfirm = () => {
    setConfirmLoading(true);
    window.setTimeout(() => {
      setConfirmLoading(false);
      setConfirmOpen(false);
      toast.success("Request cancelled");
    }, 900);
  };

  return (
    <main className="bg-sand-50 min-h-screen">
      <div className="border-sand-200 border-b bg-white">
        <div className="container-shell flex flex-col gap-1 py-8">
          <p className="text-brand-600 text-xs font-semibold tracking-widest uppercase">
            Internal · Phase 1
          </p>
          <h1 className="font-display text-sand-900 text-3xl font-semibold">
            Fayfort Design System
          </h1>
          <p className="text-sand-500 max-w-2xl text-sm">
            Component gallery for visual QA. Every primitive, state and tone in one place. Resize
            the window to verify responsive behavior.
          </p>
        </div>
      </div>

      <div className="container-shell flex flex-col gap-4 pb-24">
        {/* ------------------------------ Colors ------------------------------ */}
        <Section
          id="colors"
          title="Colors"
          description="Brand navy #06265F, accent magenta #F71968, white-based surfaces and semantic tones."
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
            {swatches.map((group) => (
              <div
                key={group.name}
                className="border-sand-200 shadow-card overflow-hidden rounded-lg border bg-white"
              >
                <div className="px-3 pt-2.5 pb-1">
                  <p className="text-sand-700 text-xs font-semibold">{group.name}</p>
                </div>
                {group.shades.map((shade) => (
                  <div
                    key={shade}
                    className="flex items-center justify-between gap-2 px-3 py-1.5"
                    style={{ backgroundColor: `var(--color-${group.name}-${shade})` }}
                  >
                    <span className="text-sand-950/60 text-[10px] font-medium">
                      {group.name}-{shade}
                    </span>
                    <span className="text-sand-950/50 text-[10px]">{shade}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>

        {/* --------------------------- Typography --------------------------- */}
        <Section id="typography" title="Typography" description="Sora display + Inter UI type.">
          <div className="border-sand-200 shadow-card flex flex-col gap-4 rounded-xl border bg-white p-6">
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-sand-900 text-4xl font-semibold">
                Know what your China purchase really costs.
              </h1>
              <p className="text-sand-400 text-xs">display · 4xl · semibold</p>
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-sand-900 text-2xl font-semibold">
                Estimate, understand, source.
              </h2>
              <p className="text-sand-400 text-xs">display · 2xl · semibold</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sand-800 text-base">
                Entire body copy renders in Inter at 16px with a relaxed line height for long
                reading on mobile and desktop.
              </p>
              <p className="text-sand-400 text-xs">body · base</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sand-500 text-sm">
                Secondary and supporting copy sits a shade quieter so the eye falls on the numbers
                first.
              </p>
              <p className="text-sand-400 text-xs">body · sm · subdued</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sand-600 text-xs font-medium tracking-wide uppercase">
                Section label · SMALL CAPS
              </p>
              <p className="text-sand-400 text-xs">label · xs · uppercase</p>
            </div>
          </div>
        </Section>

        {/* ----------------------------- Buttons ----------------------------- */}
        <Section
          id="buttons"
          title="Buttons"
          description="Six intents, three sizes, loading and disabled states."
        >
          <DemoPanel>
            <Button intent="primary" size="md">
              Calculate landed cost
            </Button>
            <Button intent="accent" size="md">
              Request Fayfort sourcing
            </Button>
            <Button intent="secondary" size="md">
              Save
            </Button>
            <Button intent="outline" size="md">
              View details
            </Button>
            <Button intent="ghost" size="md">
              Cancel
            </Button>
            <Button intent="danger" size="md">
              Delete
            </Button>
            <Button intent="danger-outline" size="md">
              Decline quote
            </Button>
          </DemoPanel>
          <DemoPanel>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">
              Large with arrow <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button intent="outline" size="icon" aria-label="Copy">
              <Copy className="size-4" aria-hidden />
            </Button>
            <Button intent="primary" loading>
              Submitting…
            </Button>
            <Button intent="outline" disabled>
              Disabled
            </Button>
          </DemoPanel>
        </Section>

        {/* ----------------------------- Badges ----------------------------- */}
        <Section
          id="badges"
          title="Badges"
          description="Tone mapping shared with status indicators."
        >
          <DemoPanel>
            {(["neutral", "brand", "info", "success", "warning", "danger", "accent"] as const).map(
              (tone) => (
                <Badge key={tone} tone={tone}>
                  {tone}
                </Badge>
              ),
            )}
          </DemoPanel>
        </Section>

        {/* --------------------------- Status pills --------------------------- */}
        <Section
          id="status"
          title="Status indicators"
          description="Sourcing request and quote statuses from the domain vocabulary."
        >
          <DemoPanel>
            {requestStatuses.map((s) => (
              <StatusPill key={s} status={s} />
            ))}
          </DemoPanel>
          <DemoPanel>
            {quoteStatuses.map((s) => (
              <StatusPill key={s} status={s} />
            ))}
          </DemoPanel>
        </Section>

        {/* --------------------------- Form controls --------------------------- */}
        <Section
          id="forms"
          title="Form controls"
          description="Inputs, selects, textareas and checkboxes across all states."
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <DemoPanel>
              <div className="flex w-full max-w-sm flex-col gap-4">
                <Field label="Product name" htmlFor="demo-product" required>
                  <Input id="demo-product" placeholder="e.g. Wireless Headphones" />
                </Field>
                <Field
                  label="Quantity"
                  htmlFor="demo-qty"
                  hint="units"
                  error="Quantity must be greater than zero."
                >
                  <Input id="demo-qty" type="number" inputMode="numeric" defaultValue="0" />
                </Field>
                <Field label="Unit price (USD)" htmlFor="demo-price">
                  <Input id="demo-price" type="text" inputMode="decimal" placeholder="0.00" />
                </Field>
                <Field label="Currency" htmlFor="demo-currency">
                  <Select id="demo-currency" defaultValue="USD">
                    <option value="USD">USD — US Dollar</option>
                    <option value="CNY">CNY — Chinese Yuan</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="NGN">NGN — Nigerian Naira</option>
                    <option value="KES">KES — Kenyan Shilling</option>
                  </Select>
                </Field>
                <Field label="Notes" htmlFor="demo-notes" hint="optional">
                  <Textarea
                    id="demo-notes"
                    placeholder="Anything we should know about this product?"
                  />
                </Field>
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox id="demo-checkbox" />
                  <label htmlFor="demo-checkbox" className="text-sand-700 text-sm">
                    I want a quote for this product
                  </label>
                </div>
              </div>
            </DemoPanel>
            <DemoPanel>
              <div className="flex w-full max-w-sm flex-col gap-4">
                <Field label="Disabled input" htmlFor="demo-disabled">
                  <Input id="demo-disabled" disabled value="Read-only value" />
                </Field>
                <div className="flex flex-col gap-2">
                  <p className="text-sand-800 text-sm font-medium">Loading skeletons</p>
                  <div className="flex flex-col gap-2.5">
                    <Skeleton className="h-10 w-full" />
                    <div className="flex flex-col gap-1.5">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    <Skeleton className="h-24 w-full rounded-xl" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Spinner size="sm" />
                  <Spinner />
                  <Spinner size="lg" />
                  <span className="text-sand-500 text-sm">spinners</span>
                </div>
              </div>
            </DemoPanel>
          </div>
        </Section>

        {/* ------------------------------- Cards ------------------------------- */}
        <Section
          id="cards"
          title="Cards"
          description="The building block for summaries, estimates and request details."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Estimated landed cost</CardTitle>
                <CardDescription>Snapshot at today&apos;s FX rate</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-display text-sand-900 text-3xl font-semibold">$18,420</p>
                <p className="text-sand-500 mt-2 text-sm">
                  Cost per unit <span className="text-sand-800 font-medium">$4.24</span>
                </p>
              </CardContent>
              <CardFooter>
                <Button size="sm" intent="outline">
                  View breakdown
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>FT-SR-000001</CardTitle>
                <CardDescription>Submitted 2 days ago</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sand-900 font-medium">Wireless earbuds</p>
                  <p className="text-sand-500 text-sm">1,000 units</p>
                </div>
                <StatusPill status="SUPPLIER_SEARCH" />
              </CardContent>
              <CardFooter>
                <Button size="sm" intent="ghost">
                  Open request
                </Button>
              </CardFooter>
            </Card>

            <Card className="border-brand-200 bg-brand-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge tone="accent">ESTIMATE</Badge>
                </CardTitle>
                <CardDescription>
                  Final costs may vary with supplier pricing, FX, freight and customs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sand-700 text-sm leading-relaxed">
                  Gross margin at your target price:{" "}
                  <span className="text-sand-900 font-semibold">21.4%</span>
                </p>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* -------------------------------- Alerts -------------------------------- */}
        <Section
          id="alerts"
          title="Alerts"
          description="Inline feedback: disclaimers, warnings and failures."
        >
          <div className="flex w-full max-w-2xl flex-col gap-3">
            <Alert tone="info" title="ESTIMATE">
              Final costs may vary depending on supplier pricing, exchange rates, freight,
              inspection, customs and other factors.
            </Alert>
            <Alert tone="success" title="Quote approved">
              Request FT-SR-000007 is now in progress.
            </Alert>
            <Alert tone="warning" title="Your quote is expiring">
              Please approve before <span className="font-semibold">Oct 15, 2026</span> to lock this
              pricing.
            </Alert>
            <Alert tone="danger" title="Unable to save">
              Your request is too large to attach. Remove a file and try again, or contact support
              if the issue persists.
            </Alert>
          </div>
        </Section>

        {/* ---------------------------- Empty + error ---------------------------- */}
        <Section
          id="empty-error"
          title="Empty + error states"
          description="Every dashboard surface gets a meaningful empty state and a recoverable error state."
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <EmptyState
              icon={Wallet}
              title="No sourcing requests yet"
              description="Calculate your first landed cost, then let Fayfort source the product for you."
              actionLabel="Calculate my landed cost"
            />
            <ErrorState
              onRetry={() => toast.info("Retrying…")}
              title="Couldn't load your requests"
              description="Your session may have expired. Sign in again and you'll find everything right here."
            />
          </div>
        </Section>

        {/* -------------------------------- Table -------------------------------- */}
        <Section
          id="table"
          title="Tables"
          description="Information-dense admin surfaces with responsive overflow."
        >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Request</TableHeadCell>
                  <TableHeadCell>Product</TableHeadCell>
                  <TableHeadCell>Quantity</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Submitted</TableHeadCell>
                  <TableHeadCell>Value</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  [
                    "FT-SR-000001",
                    "Wireless earbuds",
                    "1,000",
                    "SUPPLIER_SEARCH",
                    "Sep 20",
                    "$18,420",
                  ],
                  ["FT-SR-000002", "Solar panels 550W", "250", "QUOTE_READY", "Sep 19", "$32,750"],
                  [
                    "FT-SR-000003",
                    "Aluminum scaffolding",
                    "500",
                    "CUSTOMER_APPROVAL",
                    "Sep 18",
                    "$61,980",
                  ],
                ].map((row) => (
                  <TableRow key={row[0]}>
                    <TableCell className="text-brand-700 font-medium">{row[0]}</TableCell>
                    <TableCell>{row[1]}</TableCell>
                    <TableCell>{row[2]}</TableCell>
                    <TableCell>
                      <StatusPill status={row[3]} />
                    </TableCell>
                    <TableCell className="text-sand-500">{row[4]}</TableCell>
                    <TableCell className="font-medium">{row[5]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Section>

        {/* ------------------------------ Overlays ------------------------------ */}
        <Section
          id="overlays"
          title="Overlays & feedback"
          description="Modals, drawers, confirmations, tooltips and toasts."
        >
          <DemoPanel>
            <Button onClick={() => setModalOpen(true)}>Open modal</Button>
            <Button intent="outline" onClick={() => setDrawerOpen(true)}>
              Open drawer
            </Button>
            <Button intent="danger" onClick={() => setConfirmOpen(true)}>
              Delete request
            </Button>
            <TooltipProvider delayDuration={100}>
              <Tooltip content="Only staff can reassign requests">
                <Button intent="outline" aria-label="Assign">
                  <Plus className="size-4" aria-hidden />
                  Assign
                </Button>
              </Tooltip>
            </TooltipProvider>
            <Button intent="secondary" onClick={() => toast("Request saved as draft")}>
              Show toast
            </Button>
            <Button
              intent="secondary"
              onClick={() => toast.error("Session expired. Please sign in again.")}
            >
              Error toast
            </Button>
          </DemoPanel>

          <Modal
            open={modalOpen}
            onOpenChange={setModalOpen}
            title="Request Fayfort sourcing"
            description="We'll use your estimate to pre-fill this request."
          >
            <div className="flex flex-col gap-4">
              <Field label="Product name" htmlFor="modal-product">
                <Input id="modal-product" placeholder="Wireless Headphones" />
              </Field>
              <div className="flex items-center gap-3">
                <ImageIcon aria-hidden className="text-sand-400 size-5" />
                <Button intent="outline" size="sm">
                  <Upload className="size-4" aria-hidden /> Add product images
                </Button>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={() => setModalOpen(false)}>Submit request</Button>
                <Button intent="ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Modal>

          <Drawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            title="Request activity"
            side="right"
          >
            <div className="flex flex-col gap-4">
              {[
                ["Submitted", "You submitted this request", "Sep 18"],
                ["Under review", "Fayfort began reviewing", "Sep 19"],
                ["Supplier search", "Researching suppliers in Shenzhen", "Sep 20"],
              ].map(([title, desc, time]) => (
                <div key={title} className="flex gap-3">
                  <div className="bg-brand-50 ring-brand-200 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1">
                    <CalendarDays aria-hidden className="text-brand-600 size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sand-900 text-sm font-medium">{title}</p>
                    <p className="text-sand-500 text-sm">{desc}</p>
                    <p className="text-sand-400 mt-0.5 text-xs">{time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Drawer>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Cancel this request?"
            description={
              <>
                This will cancel <span className="font-semibold">FT-SR-000003</span> and move it to
                cancelled status. The activity history is kept for audit purposes.
              </>
            }
            confirmLabel="Cancel request"
            loading={confirmLoading}
            onConfirm={runConfirm}
          />
        </Section>

        {/* -------------------------------- Footer -------------------------------- */}
        <div className="border-sand-200 text-sand-400 flex items-center justify-between border-t pt-8 text-xs">
          <span>Fayfort Sourcing — design system v1</span>
          <a
            href="mailto:hello@fayfort.com"
            className="text-sand-500 hover:text-sand-700 inline-flex items-center gap-1"
          >
            <Mail className="size-3.5" aria-hidden /> hello@fayfort.com
          </a>
        </div>
      </div>
    </main>
  );
}
