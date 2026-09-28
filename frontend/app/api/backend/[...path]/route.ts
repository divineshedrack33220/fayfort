import { NextResponse, type NextRequest } from "next/server";
import { BACKEND_URL, SESSION_COOKIE_NAME } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Finite, generous timeout so slow/short-lived backend restarts surface as 502
// instead of hanging a tab.
export const maxDuration = 30;

type Params = { path: string[] };

/**
 * Catch-all proxy that forwards /api/backend/anything to the Go service
 * behind the same origin. Used by client components (login/register/logout,
 * notifications, chat, estimate, contact) so the session cookie set by Go
 * stays opaque to the browser and every mutation holds one contract.
 */
async function forward(request: NextRequest, context: { params: Promise<Params> }) {
  const { path } = await context.params;
  const backendPath = `/api/${path.join("/")}${request.nextUrl.search}`;
  const contentType = request.headers.get("content-type");
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (contentType) headers["Content-Type"] = contentType;
  if (sessionCookie) headers.Cookie = `${SESSION_COOKIE_NAME}=${sessionCookie}`;

  const raw = await request.text();

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${backendPath}`, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : raw || undefined,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Backend is unavailable. Try again shortly." },
      { status: 502 },
    );
  }

  const body = await res.text();
  const response = new NextResponse(body || null, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });

  // Relay the backend's session cookie so the browser holds the Go token.
  for (const setCookie of res.headers.getSetCookie()) {
    response.headers.append("set-cookie", setCookie);
  }
  return response;
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;