import { describe, expect, it } from "vitest";
import {
  breakdownBuckets,
  COST_BUCKETS,
  computeEstimate,
  computeSimplifiedEstimate,
  DEFAULT_DUTY_RATE,
  DEFAULT_UNIT_WEIGHT_KG,
  REFERENCE_RATES,
  toUsd,
  type EstimateInput,
} from "@/lib/estimate";

function baseInput(overrides: Partial<EstimateInput> = {}): EstimateInput {
  return {
    unitCostUsd: 10,
    quantity: 100,
    shipmentWeightKg: 50,
    shipmentVolumeCbm: 2,
    transportMode: "lcl",
    doorDelivery: false,
    dutyRate: 0.15,
    inspectionIncluded: false,
    ...overrides,
  };
}

describe("computeEstimate", () => {
  it("returns null when no input is provided", () => {
    expect(computeEstimate(null)).toBeNull();
  });

  it("returns null when quantity is below one", () => {
    expect(computeEstimate(baseInput({ quantity: 0 }))).toBeNull();
    expect(computeEstimate(baseInput({ quantity: 0.5 }))).toBeNull();
  });

  it("returns null when unit cost or weight is not positive", () => {
    expect(computeEstimate(baseInput({ unitCostUsd: 0 }))).toBeNull();
    expect(computeEstimate(baseInput({ unitCostUsd: -5 }))).toBeNull();
    expect(computeEstimate(baseInput({ shipmentWeightKg: 0 }))).toBeNull();
  });

  it("returns null for lcl shipments without a volume", () => {
    expect(computeEstimate(baseInput({ shipmentVolumeCbm: 0 }))).toBeNull();
  });

  it("returns null for a negative duty rate", () => {
    expect(computeEstimate(baseInput({ dutyRate: -0.1 }))).toBeNull();
  });

  it("computes duty on the CIF base (product + freight + insurance)", () => {
    const result = computeEstimate(baseInput())!;
    const product = 1000;
    const freight = 2 * REFERENCE_RATES.freight.lclPerCbmUsd;
    const insurance = product * REFERENCE_RATES.insurancePct;
    const expectedDuty = (product + freight + insurance) * 0.15;

    const duty = result.lines.find((line) => line.key === "duty");
    expect(duty?.amountUsd).toBeCloseTo(expectedDuty, 6);
  });

  it("adds the door delivery surcharge for sea shipments", () => {
    const toPort = computeEstimate(baseInput({ doorDelivery: false }))!;
    const toDoor = computeEstimate(baseInput({ doorDelivery: true }))!;
    const portFreight = toPort.lines.find((l) => l.key === "freight")!;
    const doorFreight = toDoor.lines.find((l) => l.key === "freight")!;
    expect(doorFreight.amountUsd).toBeCloseTo(
      portFreight.amountUsd + REFERENCE_RATES.freight.lclDoorFixedUsd,
      6,
    );
  });

  it("prices air by kilogram and fcl as a fixed rate", () => {
    const air = computeEstimate(
      baseInput({ transportMode: "air", shipmentVolumeCbm: 0 }),
    )!;
    const airFreight = air.lines.find((l) => l.key === "freight")!;
    expect(airFreight.amountUsd).toBeCloseTo(
      50 * REFERENCE_RATES.freight.airPerKgUsd,
      6,
    );

    const fcl = computeEstimate(
      baseInput({ transportMode: "fcl", shipmentVolumeCbm: 0 }),
    )!;
    const fclFreight = fcl.lines.find((l) => l.key === "freight")!;
    expect(fclFreight.amountUsd).toBeCloseTo(
      REFERENCE_RATES.freight.fclFixedUsd,
      6,
    );
  });

  it("includes the inspection fee only when requested", () => {
    const without = computeEstimate(baseInput())!;
    expect(without.lines.some((l) => l.key === "inspection")).toBe(false);

    const withInspection = computeEstimate(
      baseInput({ inspectionIncluded: true }),
    )!;
    const inspection = withInspection.lines.find((l) => l.key === "inspection");
    expect(inspection?.amountUsd).toBeCloseTo(
      REFERENCE_RATES.inspectionFeeUsd,
      6,
    );
  });

  it("applies the service-fee minimum for small orders", () => {
    const small = computeEstimate(baseInput({ unitCostUsd: 1, quantity: 5 }))!;
    const service = small.lines.find((l) => l.key === "service")!;
    expect(service.amountUsd).toBeCloseTo(
      REFERENCE_RATES.serviceFeeMinUsd,
      6,
    );
  });

  it("breaks the total down consistently", () => {
    const result = computeEstimate(baseInput())!;
    const sum = result.lines.reduce((s, l) => s + l.amountUsd, 0);
    expect(result.totalUsd).toBeCloseTo(sum, 6);
    expect(result.totalUsd).toBeGreaterThan(0);
  });

  it("uses an explicit inspection cost instead of the automatic fee", () => {
    const result = computeEstimate(
      baseInput({ inspectionCostUsd: 220, inspectionIncluded: true }),
    )!;
    const inspection = result.lines.find((line) => line.key === "inspection")!;
    expect(inspection.amountUsd).toBeCloseTo(220, 6);
  });

  it("uses an explicit packaging cost instead of the percentage estimate", () => {
    const result = computeEstimate(baseInput({ packagingCostUsd: 80 }))!;
    const packaging = result.lines.find((line) => line.key === "packaging")!;
    expect(packaging.amountUsd).toBeCloseTo(80, 6);
  });

  it("appends agent and other optional costs without inflating the service fee", () => {
    const without = computeEstimate(baseInput())!;
    const withOptional = computeEstimate(
      baseInput({ agentFeeUsd: 40, otherCostUsd: 60 }),
    )!;

    const serviceWithout = without.lines.find((l) => l.key === "service")!;
    const serviceWith = withOptional.lines.find((l) => l.key === "service")!;
    expect(serviceWith.amountUsd).toBeCloseTo(serviceWithout.amountUsd, 6);

    expect(withOptional.lines.some((l) => l.key === "agent-fee")).toBe(true);
    expect(withOptional.lines.some((l) => l.key === "other")).toBe(true);
    expect(withOptional.totalUsd).toBeCloseTo(
      without.totalUsd + 40 + 60,
      6,
    );
  });

  it("groups every line into exactly one cost bucket that sums to the total", () => {
    const result = computeEstimate(baseInput({ agentFeeUsd: 40 }))!;
    const buckets = breakdownBuckets(result);

    expect(buckets.map((b) => b.label)).toEqual([
      "Product Cost",
      "China Logistics",
      "Inspection",
      "International Shipping",
      "Other Estimated Costs",
    ]);
    const bucketSum = buckets.reduce((s, b) => s + b.amountUsd, 0);
    expect(bucketSum).toBeCloseTo(result.totalUsd, 6);

    const keyToBucket = new Map<string, string>();
    for (const bucket of COST_BUCKETS) {
      for (const lineKey of bucket.keys) {
        expect(keyToBucket.has(lineKey)).toBe(false);
        keyToBucket.set(lineKey, bucket.key);
      }
    }
    for (const line of result.lines) {
      expect(keyToBucket.has(line.key)).toBe(true);
    }
  });
});

describe("toUsd", () => {
  it("keeps USD amounts unchanged", () => {
    expect(toUsd(12.5, "USD")).toBeCloseTo(12.5, 6);
  });

  it("converts via the reference rate table", () => {
    expect(toUsd(720, "CNY")).toBeCloseTo(100, 6);
    expect(toUsd(150_000, "NGN")).toBeCloseTo(100, 6);
  });

  it("returns the amount unchanged for unknown currencies", () => {
    expect(toUsd(50, "XYZ")).toBeCloseTo(50, 6);
  });

  it("returns the amount unchanged for a zero or missing rate", () => {
    expect(toUsd(50, "")).toBeCloseTo(50, 6);
    expect(toUsd(1.5, "USD")).toBeCloseTo(1.5, 6);
  });
});

describe("computeSimplifiedEstimate", () => {
  it("returns null for unusable core input", () => {
    expect(computeSimplifiedEstimate(null)).toBeNull();
    expect(
      computeSimplifiedEstimate({ unitCostUsd: 0, quantity: 10, transportMode: "lcl" }),
    ).toBeNull();
    expect(
      computeSimplifiedEstimate({ unitCostUsd: 5, quantity: 0, transportMode: "lcl" }),
    ).toBeNull();
  });

  it("estimates without any weight, size or duty input", () => {
    const estimate = computeSimplifiedEstimate({
      unitCostUsd: 12.5,
      quantity: 500,
      transportMode: "lcl",
    })!;
    expect(estimate).not.toBeNull();
    expect(estimate.weightDefaulted).toBe(true);
    expect(estimate.volumeDefaulted).toBe(true);
    expect(estimate.dutyRate).toBeCloseTo(DEFAULT_DUTY_RATE, 6);
    expect(estimate.weightKg).toBeCloseTo(
      DEFAULT_UNIT_WEIGHT_KG * 500,
      6,
    );
    expect(estimate.volumeCbm).toBeGreaterThan(0);
    expect(estimate.result.totalUsd).toBeGreaterThan(0);
  });

  it("honours explicit weight, volume and duty when provided", () => {
    const estimate = computeSimplifiedEstimate({
      unitCostUsd: 10,
      quantity: 100,
      transportMode: "air",
      weightKg: 40,
      volumeCbm: 0.5,
      dutyRate: 0.08,
    })!;
    expect(estimate.weightDefaulted).toBe(false);
    expect(estimate.volumeDefaulted).toBe(false);
    expect(estimate.weightKg).toBeCloseTo(40, 6);
    expect(estimate.volumeCbm).toBeCloseTo(0.5, 6);
    expect(estimate.dutyRate).toBeCloseTo(0.08, 6);
  });

  it("always includes inspection and a service fee for the managed path", () => {
    const estimate = computeSimplifiedEstimate({
      unitCostUsd: 2,
      quantity: 10,
      transportMode: "lcl",
    })!;
    expect(estimate.result.lines.some((l) => l.key === "inspection")).toBe(true);
    expect(estimate.result.lines.some((l) => l.key === "service")).toBe(true);
    expect(estimate.result.lines.some((l) => l.key === "packaging")).toBe(true);
  });

  it("includes door delivery by default", () => {
    const estimate = computeSimplifiedEstimate({
      unitCostUsd: 10,
      quantity: 100,
      transportMode: "lcl",
    })!;
    const freight = estimate.result.lines.find((l) => l.key === "freight")!;
    expect(freight.amountUsd).toBeCloseTo(
      estimate.volumeCbm * REFERENCE_RATES.freight.lclPerCbmUsd +
        REFERENCE_RATES.freight.lclDoorFixedUsd,
      6,
    );
  });
});