This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## PWA support

The app is installable and works offline for its static shell:

- `app/manifest.ts` — typed web app manifest (icons, shortcuts, `standalone`).
- `public/sw.js` — plain service worker, served from the origin root so its
  scope covers every route. `next.config.ts` sends it with `no-store` and
  `Service-Worker-Allowed: /`; keep it a static file so updates are picked up.
- `components/pwa/service-worker-provider.tsx` — registers `/sw.js`, polls for
  updates and offers a reload prompt.
- `components/pwa/install-prompt.tsx` — the install card. It reacts to
  `beforeinstallprompt`, which Chromium only fires for an installable app, and
  falls back to iOS instructions.
- `components/pwa/push-notification-toggle.tsx` — opt-in Web Push. The VAPID
  public key is fetched from the backend, never baked into the bundle.
- `public/icon-*.png`, `public/apple-touch-icon.png`, `public/badge-96.png`.

Caching rules: the worker precaches `/offline` and the icons, serves hashed
build assets cache-first, and falls back to `/offline` for navigations. Signed-in
HTML and every `/api/*` response are never cached, so a cached page can never
leak one account's data to another.

To verify a change, build and serve the production output — the dev server does
not behave identically:

```bash
npm run build && npm run start
```

Browsers only grant notification permission and only run an installed app over
HTTPS (localhost is exempt), so serve the frontend behind TLS in production.

## Calls (LiveKit)

Staff and customers can start an audio or video call from a conversation. The
split is deliberate: LiveKit carries the media, and the existing chat WebSocket
(`/api/ws`) carries the ringing, so a call inherits the same per-thread
authorisation as the messages around it.

- `app/api/calls/token/route.ts` mints the room grant. A customer may only
  request a token for their own thread, staff for any thread they can see, and
  the grant is scoped to a single room derived from the thread id.
- `lib/call-session.ts` wraps `livekit-client`. The SDK is imported
  dynamically, so a visitor who never calls never downloads it.
- `components/ui/use-call.ts` owns the call state machine; the hub rings for 45
  seconds, replays a missed ring to whoever opens the thread next, and cancels
  it if the caller's socket drops.
- `components/ui/call-overlay.tsx` renders the ringing card and the connected
  window for both `/chat` and `/admin/messages`.

Set these in `.env.local` (server-side only — the secret must never reach the
browser, and there is no `NEXT_PUBLIC_` variant):

```bash
LIVEKIT_URL=wss://<project>.livekit.cloud
LIVEKIT_API_KEY=<api key>
LIVEKIT_API_SECRET=<api secret>
```

Without all three, calls are unavailable: the token route answers `503` and the
chat surfaces say so instead of ringing anyone.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
