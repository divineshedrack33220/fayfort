"use server";

import { revalidatePath } from "next/cache";
import { getRequestById, issueQuote } from "@/lib/data/admin";

export interface IssueQuoteResult {
  ok: boolean;
  quoteId?: string;
  error?: string;
}

export async function issueQuoteToRequest(input: {
  requestId: string;
  product: string;
  customer: string;
  supplier: string;
  valueUsd: number;
  marginBps: number;
  imageUrls?: string[];
}): Promise<IssueQuoteResult> {
  const requestId = input.requestId.trim();
  const request = await getRequestById(requestId);
  if (!request) return { ok: false, error: "Sourcing request not found." };

  const supplier = input.supplier.trim();
  if (!supplier) return { ok: false, error: "Add a supplier name before sending." };
  if (!Number.isFinite(input.valueUsd) || input.valueUsd <= 0) {
    return { ok: false, error: "Customer price must be greater than zero." };
  }

  try {
    const quote = await issueQuote(requestId, {
      supplier,
      valueUsd: input.valueUsd,
      marginBps: input.marginBps,
      imageUrls: input.imageUrls,
    });
    revalidatePath("/admin/quotes");
    revalidatePath(`/admin/requests/${requestId}`);
    return { ok: true, quoteId: quote.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not issue the quote." };
  }
}