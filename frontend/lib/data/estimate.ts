import "server-only";

import { backend } from "@/lib/backend";
import type { SimplifiedEstimate } from "@/lib/estimate";

export interface SimplifiedEstimateInputWire {
  unitCostUsd: number;
  quantity: number;
  transportMode: "lcl" | "air";
  weightKg?: number;
  volumeCbm?: number;
  dutyRate?: number;
  doorDelivery?: boolean;
}

/**
 * Compute the beginner-friendly estimate on the backend (mirrors
 * computeSimplifiedEstimate in lib/estimate.ts). Returns null when the
 * core input is unusable — same contract as the client-side helper.
 */
export async function getSimplifiedEstimate(
  input: SimplifiedEstimateInputWire,
): Promise<SimplifiedEstimate | null> {
  const payload = await backend<{ ok: boolean; result: SimplifiedEstimate | null }>(
    "/api/estimate/simplified",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return payload.ok ? payload.result : null;
}