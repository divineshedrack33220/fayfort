import { type AdminRequestRow } from "./admin";
import { REQUEST_STATUSES, type RequestStatus } from "./status";

/** Customer details surfaced in the request workspace. */
export interface RequestCustomerInfo {
  name: string;
  email: string;
  phone: string;
  previousRequests: number;
  notes: string;
}

/** Product details surfaced in the request workspace. */
export interface RequestProductInfo {
  name: string;
  category: string;
  description: string;
  quantity: number;
  budget: number;
  currency: string;
  destination: string;
  requirements: string[];
}

/** A single event on the request timeline. */
export interface RequestTimelineEvent {
  label: string;
  date: string;
  time: string;
  admin: string;
  notes: string;
  state: "done" | "active" | "pending";
}

const EMAIL_SLUG: Record<string, string> = {
  "David Green": "david.green",
  "Ama Mensah": "ama.mensah",
  "Ngozi Eze": "ngozi.eze",
  "Blessing Adeyemi": "blessing.adeyemi",
  "Kwame Boateng": "kwame.boateng",
};

const CUSTOMER_FILL: Record<
  string,
  { email: string; phone: string; notes: string }
> = {
  "David Green": {
    email: "david.green@gmail.com",
    phone: "+233 24 555 0181",
    notes: "Repeat buyer from Accra. Prefers DDP door-to-door pricing with freight included.",
  },
  "Ama Mensah": {
    email: "ama.mensah@outlook.com",
    phone: "+234 803 412 7710",
    notes: "Fashion retailer operating across Lagos boutiques. Needs MOQ bu. 200 per style.",
  },
  "Ngozi Eze": {
    email: "ngozi.eze@gmail.com",
    phone: "+234 806 220 3490",
    notes: "Distributor — quantities vary between 200–600 units. Values inspection records.",
  },
  "Blessing Adeyemi": {
    email: "blessing.adeyemi@yahoo.com",
    phone: "+234 818 337 2055",
    notes: "T-shirt wholesaler. Previously declined a quote due to freight cost.",
  },
  "Kwame Boateng": {
    email: "kwame.boateng@gmail.com",
    phone: "+233 20 998 1402",
    notes: "New customer. Lighting products for retail resale across Accra.",
  },
};

const PRODUCT_FILL: Record<
  string,
  { description: string; requirements: string[] }
> = {
  "Wireless Headphones": {
    description:
      "Over-ear wireless headphones, active noise cancelling, 30h battery, foldable for compact freight. Finish in matte black.",
    requirements: [
      "CE + RoHS certification",
      "Retail-ready packaging with logo print",
      "Fragile-marked cartons",
    ],
  },
  Handbags: {
    description:
      "Structured PU handbags with brass-tone hardware, lined interior and reinforced handles. Source colours: black, tan, burgundy.",
    requirements: [
      "One sample per colour before production",
      "Stitching + hardware quality check",
      "Polybagged individually",
    ],
  },
  Sneakers: {
    description:
      "Lifestyle low-top sneakers, cushioned insole, rubber outsole with arch support. Unisex sizing, brand-neutral boxes.",
    requirements: [
      "Materials + colours confirmed via sample",
      "Size run QC — 39–45",
      "MOQ 500 units per colourway",
    ],
  },
  "Smart Watches": {
    description:
      "Fitness smartwatch, AMOLED display, GPS, 7-day battery, silicone straps. _italic_ bluetooth 5.2.",
    requirements: [
      "Certification documents (CE, FCC)",
      "Fast-charge adapter included",
      "Warranty terms negotiated",
    ],
  },
  "Men’s T-Shirts": {
    description:
      "100% combed cotton crew-neck tees, 210gsm, pre-shrunk. Packaged flat, 12 per export carton.",
    requirements: [
      "Wash-test report at 40°C",
      "Size specs 2XL–5XL included",
      "Plain + print-ready options",
    ],
  },
  "LED Desk Lamps": {
    description:
      "Dimmable LED desk lamps with USB-C charging port, touch control, aluminium body. Warm/cool switch.",
    requirements: [
      "CE / RoHS certificates",
      "Stress test on flexible neck",
      "Design-left prototype first",
    ],
  },
  "Ceramic Dinner Sets": {
    description:
      "16-piece stoneware dinner sets, microwave + dishwasher safe, reactive glaze in cream. Packed with bubble wrap.",
    requirements: [
      "Drop-test packaging report",
      "Lead-free glaze certificate",
      "Chipped-item threshold < 1%",
    ],
  },
};

const STAGE_DEFS: Array<{ label: string; statuses: RequestStatus[] }> = [
  { label: "Submitted", statuses: ["SUBMITTED"] },
  { label: "Under review", statuses: ["UNDER_REVIEW"] },
  { label: "Supplier search", statuses: ["SUPPLIER_SEARCH"] },
  { label: "Quote prepared", statuses: ["QUOTE_READY"] },
  { label: "Customer approved", statuses: ["CUSTOMER_APPROVAL"] },
  { label: "Purchasing", statuses: ["APPROVED", "IN_PROGRESS"] },
  { label: "Inspection", statuses: ["CONVERTED"] },
  { label: "Shipping", statuses: [] },
  { label: "Delivered", statuses: ["COMPLETED", "CLOSED"] },
];

const STEP_ADMINS = [
  "Ada Okafor",
  "Tunde Bello",
  "Chioma Eze",
  "Tunde Bello",
  "Chioma Eze",
  "Sami Mbeki",
  "Chioma Eze",
  "Ada Okafor",
  "Ada Okafor",
];

const STEP_NOTES = [
  "Request received through the portal and assigned for review.",
  "Product and requirements validated against supplier capability.",
  "Shortlisted 3 suppliers and requested capability documents.",
  "Landed-cost quote compiled and sent to the customer.",
  "Quote accepted — purchase order prepared.",
  "PO placed with the factory; production scheduled.",
  "Pre-shipment inspection booked at the factory.",
  "Consignment dispatched and tracked to destination.",
  "Order delivered and signed off by the customer.",
];

const STEP_TIMES = ["09:41", "15:08", "11:52", "16:30", "12:14", "10:02", "14:26", "09:15", "11:47"];

function addDays(dateLabel: string, days: number): string {
  const ts = Date.parse(dateLabel);
  if (Number.isNaN(ts)) return dateLabel;
  const date = new Date(ts + days * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
}

function activeStep(status: RequestStatus): number {
  const index = STAGE_DEFS.findIndex((def) => def.statuses.includes(status));
  return status === "CANCELLED" ? 0 : index === -1 ? 0 : index;
}

export function requestCustomerInfo(
  request: AdminRequestRow,
  previousRequests = 0,
): RequestCustomerInfo {
  const fill = CUSTOMER_FILL[request.customer] ?? {
    email: "customer@example.com",
    phone: "+000 000 0000",
    notes: "No customer notes recorded.",
  };
  const slug = EMAIL_SLUG[request.customer] ?? "customer";
  return {
    name: request.customer,
    email: fill.email ?? `${slug}@gmail.com`,
    phone: fill.phone,
    previousRequests,
    notes: fill.notes,
  };
}

export function requestProductInfo(request: AdminRequestRow): RequestProductInfo {
  const fill = PRODUCT_FILL[request.product] ?? {
    description: `Sourced ${request.category.toLowerCase()} consignment shipped to ${request.city}.`,
    requirements: ["Samples required before production", "Inspection before dispatch"],
  };
  return {
    name: request.product,
    category: request.category,
    description: fill.description.replace("_italic_ ", ""),
    quantity: request.quantity,
    budget: request.budget,
    currency: request.currency,
    destination: request.city,
    requirements: fill.requirements,
  };
}

export function requestTimeline(request: AdminRequestRow): RequestTimelineEvent[] {
  const active = activeStep(request.status);
  return STAGE_DEFS.map((def, index) => ({
    label: def.label,
    date: addDays(request.date, index),
    time: STEP_TIMES[index],
    admin: STEP_ADMINS[index],
    notes: STEP_NOTES[index],
    state: index < active ? "done" : index === active ? "active" : "pending",
  }));
}

export function requestStatusIndex(status: RequestStatus): number {
  return REQUEST_STATUSES.indexOf(status);
}