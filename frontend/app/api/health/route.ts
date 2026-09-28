import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "fayfort",
    status: "healthy",
    time: new Date().toISOString(),
  });
}