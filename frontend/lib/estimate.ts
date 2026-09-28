/**
 * Landed-cost estimate math for the frontend preview.
 *
 * This is a UI preview: the reference rates below are clearly illustrative
 * defaults. Phase 3 replaces them with server-curated rates stored in
 * Postgres and computes estimates server-side, so everything here stays
 * testable pure functions and nothing ever claims to be authoritative.
 */

export type TransportMode = "lcl" | "fcl" | "air";

/** Illustrative preview rates — NOT authoritative. Replaced by server data in Phase 3. */
export const REFERENCE_RATES = {
  packagingFeePct: 0.03,
  packagingFeeMinUsd: 25,
  insurancePct: 0.005,
  inspectionFeeUsd: 150,
  clearingSeaUsd: 120,
  clearingAirUsd: 90,
  fxContingencyPct: 0.015,
  serviceFeePct: 0.075,
  serviceFeeMinUsd: 40,
  freight: {
    lclPerCbmUsd: 45,
    lclDoorFixedUsd: 150,
    fclFixedUsd: 1450,
    fclDoorFixedUsd: 200,
    airPerKgUsd: 4.2,
    airDoorFixedUsd: 60,
  },
} as const;

/** Reference FX used to show naira figures on the estimate results page. */
export const REFERENCE_FX_NGN_PER_USD = 1500;

/**
 * Illustrative reference FX — units of foreign currency per 1 USD — used to
 * convert the supplier's quoted unit price into USD for the simplified
 * calculator flow. NOT authoritative; replaced by server rates in Phase 3.
 */
export const REFERENCE_FX_PER_USD: Record<string, number> = {
  USD: 1,
  CNY: 7.2,
  NGN: 1500,
  KES: 130,
  GHS: 15.8,
  ZAR: 18.5,
  UGX: 3700,
  TZS: 2650,
  EUR: 0.92,
  GBP: 0.79,
};

/** Converts an amount in the given currency into USD using the reference table. */
export function toUsd(amount: number, currency: string): number {
  const rate = REFERENCE_FX_PER_USD[currency];
  if (!Number.isFinite(rate) || rate <= 0) {
    return amount;
  }
  return amount / rate;
}

/**
 * Default per-unit size assumptions used by the simplified calculator when the
 * customer doesn't provide weight or dimensions, so freight can still be
 * estimated without asking for logistics expertise.
 */
export const DEFAULT_UNIT_WEIGHT_KG = 0.5;
export const DEFAULT_UNIT_VOLUME_CBM = 0.01;

/** Generic duty & tax allowance whenever the customer doesn't enter a rate. */
export const DEFAULT_DUTY_RATE = 0.12;

export interface SimplifiedEstimateInput {
  unitCostUsd: number;
  quantity: number;
  /** "sea" for lower cost, "air" for faster. "Not sure" maps to sea upstream. */
  transportMode: "lcl" | "air";
  /** Total shipment weight in kg — optional; a per-unit default is assumed. */
  weightKg?: number;
  /** Total shipment volume in CBM — optional; a per-unit default is assumed. */
  volumeCbm?: number;
  /** Optional explicit duty rate; a generic default is assumed otherwise. */
  dutyRate?: number;
  /** Whether door delivery is included (defaults to true for the preview). */
  doorDelivery?: boolean;
}

export interface SimplifiedEstimate {
  result: EstimateResult;
  weightKg: number;
  volumeCbm: number;
  weightDefaulted: boolean;
  volumeDefaulted: boolean;
  dutyRate: number;
}

/**
 * The beginner-friendly estimate path: returns null only when the core input
 * is unusable. Weight, volume and duty all fall back to internal assumptions
 * so the customer only ever needs what they actually know.
 * Inspection is always included (Fayfort-managed); packaging, FX buffer and
 * the service fee are added by the engine as Fayfort-side costs.
 */
export function computeSimplifiedEstimate(
  input: SimplifiedEstimateInput | null,
): SimplifiedEstimate | null {
  if (
    !input ||
    !isFinitePositive(input.unitCostUsd) ||
    !(input.quantity >= 1)
  ) {
    return null;
  }
  const weightKg = isFinitePositive(input.weightKg ?? 0)
    ? (input.weightKg as number)
    : DEFAULT_UNIT_WEIGHT_KG * input.quantity;
  const volumeCbm = isFinitePositive(input.volumeCbm ?? 0)
    ? (input.volumeCbm as number)
    : DEFAULT_UNIT_VOLUME_CBM * input.quantity;
  const dutyRate = isFinitePositive(input.dutyRate ?? 0)
    ? (input.dutyRate as number)
    : DEFAULT_DUTY_RATE;

  const result = computeEstimate({
    unitCostUsd: input.unitCostUsd,
    quantity: input.quantity,
    shipmentWeightKg: weightKg,
    shipmentVolumeCbm: volumeCbm,
    transportMode: input.transportMode,
    doorDelivery: input.doorDelivery ?? true,
    dutyRate,
    inspectionIncluded: true,
  });
  if (!result) {
    return null;
  }
  return {
    result,
    weightKg,
    volumeCbm,
    weightDefaulted: !isFinitePositive(input.weightKg ?? 0),
    volumeDefaulted: !isFinitePositive(input.volumeCbm ?? 0),
    dutyRate,
  };
}

export interface EstimateInput {
  unitCostUsd: number;
  quantity: number;
  shipmentWeightKg: number;
  shipmentVolumeCbm: number;
  transportMode: TransportMode;
  doorDelivery: boolean;
  dutyRate: number;
  inspectionIncluded: boolean;
  /**
   * Optional costs entered by the user. When provided, a positive inspection
   * cost replaces the automatic inspection fee and a positive packaging cost
   * replaces the automatic packaging estimate; agent/other costs are appended
   * as plain line items (outside the FX buffer and service fee).
   */
  inspectionCostUsd?: number;
  packagingCostUsd?: number;
  agentFeeUsd?: number;
  otherCostUsd?: number;
}

export interface CostLine {
  key: string;
  label: string;
  amountUsd: number;
}

export interface EstimateResult {
  lines: CostLine[];
  subtotalBeforeServiceUsd: number;
  serviceFeeUsd: number;
  totalUsd: number;
}

function freightUsd(input: EstimateInput): number {
  const { freight } = REFERENCE_RATES;
  const delivery = input.doorDelivery
    ? {
        lcl: freight.lclDoorFixedUsd,
        fcl: freight.fclDoorFixedUsd,
        air: freight.airDoorFixedUsd,
      }[input.transportMode]
    : 0;
  switch (input.transportMode) {
    case "air":
      return input.shipmentWeightKg * freight.airPerKgUsd + delivery;
    case "fcl":
      return freight.fclFixedUsd + delivery;
    case "lcl":
      return input.shipmentVolumeCbm * freight.lclPerCbmUsd + delivery;
  }
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Returns null when the input is not fully usable (so callers can show
 * validation state instead of a misleading number).
 */
export function computeEstimate(
  input: EstimateInput | null,
): EstimateResult | null {
  const rates = REFERENCE_RATES;
  if (
    !input ||
    !isFinitePositive(input.unitCostUsd) ||
    !(input.quantity >= 1) ||
    !isFinitePositive(input.shipmentWeightKg) ||
    !(input.dutyRate >= 0) ||
    (input.transportMode === "lcl" && !isFinitePositive(input.shipmentVolumeCbm))
  ) {
    return null;
  }

  const productTotal = input.unitCostUsd * input.quantity;
  const freight = freightUsd(input);
  const insurance = productTotal * rates.insurancePct;
  const packaging = isFinitePositive(input.packagingCostUsd ?? 0)
    ? (input.packagingCostUsd as number)
    : Math.max(productTotal * rates.packagingFeePct, rates.packagingFeeMinUsd);
  const duty = (productTotal + freight + insurance) * input.dutyRate;
  const clearance =
    input.transportMode === "air" ? rates.clearingAirUsd : rates.clearingSeaUsd;
  const inspection = isFinitePositive(input.inspectionCostUsd ?? 0)
    ? (input.inspectionCostUsd as number)
    : input.inspectionIncluded
      ? rates.inspectionFeeUsd
      : 0;

  const lines: CostLine[] = [
    { key: "product", label: "Product cost", amountUsd: productTotal },
    {
      key: "freight",
      label: "International freight & local delivery",
      amountUsd: freight,
    },
    { key: "insurance", label: "Cargo insurance", amountUsd: insurance },
    {
      key: "packaging",
      label: "Supplier & packaging fees",
      amountUsd: packaging,
    },
    {
      key: "duty",
      label: "Customs duty & taxes",
      amountUsd: duty,
    },
    { key: "clearance", label: "Clearance & customs handling", amountUsd: clearance },
    ...(inspection > 0
      ? [{ key: "inspection", label: "Quality inspection", amountUsd: inspection }]
      : []),
    {
      key: "fx",
      label: "FX & contingency buffer",
      amountUsd:
        (productTotal + freight + insurance + packaging + duty + clearance) *
        rates.fxContingencyPct,
    },
  ];

  const subtotalBeforeServiceUsd = lines.reduce(
    (sum, line) => sum + line.amountUsd,
    0,
  );
  const serviceFeeUsd = Math.max(
    productTotal * rates.serviceFeePct,
    rates.serviceFeeMinUsd,
  );

  const optionalLines: CostLine[] = [];
  if (isFinitePositive(input.agentFeeUsd ?? 0)) {
    optionalLines.push({
      key: "agent-fee",
      label: "Agent / service fee",
      amountUsd: input.agentFeeUsd as number,
    });
  }
  if (isFinitePositive(input.otherCostUsd ?? 0)) {
    optionalLines.push({
      key: "other",
      label: "Other costs",
      amountUsd: input.otherCostUsd as number,
    });
  }

  return {
    lines: [
      ...lines,
      ...optionalLines,
      {
        key: "service",
        label: "Fayfort sourcing fee",
        amountUsd: serviceFeeUsd,
      },
    ],
    subtotalBeforeServiceUsd,
    serviceFeeUsd,
    totalUsd:
      subtotalBeforeServiceUsd +
      optionalLines.reduce((sum, line) => sum + line.amountUsd, 0) +
      serviceFeeUsd,
  };
}

/** Short label used in the transport-mode selector. */
export const TRANSPORT_MODE_LABELS: Record<
  TransportMode,
  { short: string; long: string }
> = {
  lcl: { short: "Sea freight (LCL)", long: "Less than container load — paid per cubic metre" },
  fcl: { short: "Sea freight (FCL)", long: "Full container load — fixed all-in rate" },
  air: { short: "Air freight", long: "Fastest, per kilogram of chargeable weight" },
};

/** Illustrative duty-rate guidance by category. User always enters the real rate. */
export const DUTY_HINTS: Record<string, number> = {
  Garments: 0.2,
  Electronics: 0.1,
  Machinery: 0.12,
  "Household goods": 0.15,
  Construction: 0.18,
  "Food & beverage": 0.25,
  Packaging: 0.1,
  "Furniture": 0.2,
  "Spare parts": 0.1,
  Other: 0.12,
};

export function categoryOf(label: string): string {
  return DUTY_HINTS[label] !== undefined ? label : "Other";
}

/**
 * The five high-level cost buckets shown on the estimate results page.
 * Every line produced by computeEstimate maps to exactly one bucket.
 */
export const COST_BUCKETS: { key: string; label: string; keys: string[] }[] = [
  { key: "product", label: "Product Cost", keys: ["product"] },
  {
    key: "china",
    label: "China Logistics",
    keys: ["freight", "packaging"],
  },
  { key: "inspection", label: "Inspection", keys: ["inspection"] },
  {
    key: "shipping",
    label: "International Shipping",
    keys: ["insurance", "clearance"],
  },
  {
    key: "other",
    label: "Other Estimated Costs",
    keys: ["duty", "fx", "agent-fee", "other", "service"],
  },
];

/** Groups the result lines into the five chart buckets, preserving total. */
export function breakdownBuckets(result: EstimateResult): CostLine[] {
  return COST_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    amountUsd: result.lines.reduce(
      (sum, line) =>
        bucket.keys.includes(line.key) ? sum + line.amountUsd : sum,
      0,
    ),
  }));
}