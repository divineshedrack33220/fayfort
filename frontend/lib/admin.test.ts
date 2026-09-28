import { describe, expect, it } from "vitest";
import {
  STAFF_CREDENTIALS,
  INSPECTION_CHECKLIST,
  formatNaira,
  formatUsd,
  orderTimelineFromStatus,
  pipelineStageLabel,
  pipelineStageStatuses,
  shipmentTimelineFromStatus,
  supplierVerification,
} from "@/lib/admin";

describe("admin helpers", () => {
  it("exposes the seeded staff credentials for bootstrap", () => {
    expect(STAFF_CREDENTIALS.email).toBe("admin@fayfort.com");
    expect(STAFF_CREDENTIALS.password).toHaveLength(8);
    expect(STAFF_CREDENTIALS.name).toBeTruthy();
  });

  it("keeps every inspection checklist item in shape", () => {
    expect(INSPECTION_CHECKLIST.length).toBeGreaterThanOrEqual(6);
    for (const item of INSPECTION_CHECKLIST) {
      expect(item.key).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.intro).toBeTruthy();
    }
  });
});

describe("shipmentTimelineFromStatus", () => {
  it("renders the full seven-stage pipeline spec", () => {
    const stages = shipmentTimelineFromStatus("DELIVERED");
    expect(stages).toHaveLength(7);
    expect(stages.map((stage) => stage.label)).toEqual([
      "Warehouse",
      "Dispatched",
      "In transit",
      "Arrived",
      "Customs",
      "Out for delivery",
      "Delivered",
    ]);
  });

  it("marks exactly one stage active and completed stages done", () => {
    const stages = shipmentTimelineFromStatus("IN_TRANSIT");
    expect(stages).toHaveLength(7);
    expect(stages.filter((stage) => stage.state === "active")).toHaveLength(1);
    expect(stages.filter((stage) => stage.state === "done")).toHaveLength(2);
  });

  it("completes every stage for a delivered shipment", () => {
    expect(shipmentTimelineFromStatus("DELIVERED").every((stage) => stage.state === "done")).toBe(
      true,
    );
  });
});

describe("orderTimelineFromStatus", () => {
  it("renders the seven-stage order pipeline in order", () => {
    const stages = orderTimelineFromStatus("SHIPPING");
    expect(stages.map((stage) => stage.label)).toEqual([
      "Payment",
      "Purchasing",
      "Supplier processing",
      "Inspection",
      "Warehouse",
      "Shipping",
      "Delivered",
    ]);
    expect(stages.filter((stage) => stage.state === "active")).toHaveLength(1);
    expect(stages.filter((stage) => stage.state === "done")).toHaveLength(5);
  });

  it("completes every stage for a delivered order", () => {
    expect(orderTimelineFromStatus("DELIVERED").every((stage) => stage.state === "done")).toBe(
      true,
    );
  });
});

describe("formatNaira / formatUsd", () => {
  it("formats naira with the ₦ symbol and no decimals", () => {
    expect(formatNaira(1500000)).toBe("₦1,500,000");
  });

  it("formats USD with the $ symbol and no decimals", () => {
    expect(formatUsd(12500)).toBe("$12,500");
  });
});

describe("pipeline stage mapping", () => {
  it("maps every known stage to its statuses", () => {
    expect(pipelineStageStatuses("INSPECTION")).toEqual(["CONVERTED"]);
    expect(pipelineStageStatuses("PURCHASING")).toEqual(["APPROVED", "IN_PROGRESS"]);
  });

  it("resolves a label for every known stage", () => {
    expect(pipelineStageLabel("QUOTE_PREPARED")).toBe("Quote prepared");
  });

  it("stays empty for unknown stage keys", () => {
    expect(pipelineStageStatuses("NOPE")).toEqual([]);
    expect(pipelineStageLabel("NOPE")).toBeUndefined();
  });
});

describe("supplierVerification", () => {
  const base = {
    id: "SUP-1",
    name: "Test Factory",
    city: "Shenzhen",
    country: "China",
    category: "Electronics",
    reliability: 90,
    leadDays: "12-16 days",
    moq: "100 units",
    contactEmail: "export@test.cn",
    contactPhone: "+86 000 0000",
    paymentTerms: "T/T",
    products: [],
    notes: "",
    requests: 1,
    since: "2024",
  };

  it("verifies every item for an approved supplier", () => {
    const items = supplierVerification({ ...base, status: "VERIFIED" });
    expect(items.every((item) => item.status === "VERIFIED")).toBe(true);
  });

  it("flags delays as failures on an at-risk supplier", () => {
    const items = supplierVerification({ ...base, status: "AT_RISK" });
    expect(items.some((item) => item.status === "FAILED")).toBe(true);
  });

  it("leaves pending suppliers with pending items", () => {
    const items = supplierVerification({ ...base, status: "PENDING" });
    expect(items.some((item) => item.status === "PENDING")).toBe(true);
  });
});