import { AccessToken, type AccessTokenOptions } from "livekit-server-sdk";
import { getAdminThreads } from "@/lib/data/admin";
import { getPortalThread } from "@/lib/data/portal";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How long a minted token stays valid. Short by design: a call token is only
 * ever needed to join one room, and a leaked one should die quickly. Rejoining
 * after a refresh goes through this endpoint again.
 */
const TOKEN_TTL = "15m";

/**
 * Calls are 1:1 between a customer and the staff working their thread, so the
 * room is derived from the thread id. Deriving it here (rather than accepting
 * a room name from the browser) means both sides independently compute the
 * same room without the client being able to aim a token at someone else's.
 */
function roomNameFor(threadId: string) {
  return `fayfort-call-${threadId}`;
}

const livekit = (() => {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
})();

/**
 * Mints a LiveKit access token for one conversation.
 *
 * Authorisation mirrors the chat itself: a customer may only call on their own
 * thread, and staff may call on any thread. The grant is scoped to that single
 * room and expires quickly, so a token cannot be reused elsewhere.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Sign in to start a call." }, { status: 401 });
  }
  if (!livekit) {
    return Response.json({ error: "Calls are not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { threadId?: unknown } | null;
  const threadId = typeof body?.threadId === "string" ? body.threadId.trim() : "";
  if (!threadId || threadId.length > 64) {
    return Response.json({ error: "A conversation is required." }, { status: 400 });
  }

  const isAdmin = session.role === "admin";
  if (isAdmin) {
    const threads = await getAdminThreads();
    if (!threads.some((thread) => thread.id === threadId)) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }
  } else {
    // A customer has exactly one thread, so this is the ownership check.
    const thread = await getPortalThread();
    if (!thread || thread.id !== threadId) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }
  }

  const options: AccessTokenOptions = {
    identity: session.email,
    name: session.name ?? session.email,
    ttl: TOKEN_TTL,
  };
  const token = new AccessToken(livekit.apiKey, livekit.apiSecret, options);
  token.addGrant({
    room: roomNameFor(threadId),
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return Response.json({
    ok: true,
    token: await token.toJwt(),
    url: livekit.url,
    room: roomNameFor(threadId),
  });
}
