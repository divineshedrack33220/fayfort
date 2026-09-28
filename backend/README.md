# Fayfort backend

Standalone Go service that replaces the frontend prototype's static demo data
with a real API. A single SQLite database (embedded via `modernc.org/sqlite`,
no cgo) carries the full domain; the demo records, IDs and statuses are seeded
byte-for-byte from the frontend's `lib/*` modules so a wired-up client sees
identical data.

## Run

```sh
go run ./cmd/server            # listens on :8080, writes ./fayfort.db
go run ./cmd/server -db :memory: -addr :3100
```

Flags:

- `-addr` — listen address (default `:8080`)
- `-db` — SQLite file (default `./fayfort.db`; use `:memory:` for ephemeral)

When `TURSO_DATABASE_URL` (and `TURSO_AUTH_TOKEN`) are set, the service stores
everything in a Turso Cloud database over HTTP instead — durable across
restarts and deploys, which is what the production deployment uses.

On first boot the demo dataset is seeded only when `-seed` is passed
(idempotent, per-table skip); `seedAccounts` always provisions two accounts:

| Account             | Email                 | Password  | Role     | Linked demo identity |
|---------------------|-----------------------|-----------|----------|----------------------|
| Admin               | `admin@fayfort.com`   | `admin123`| admin    | Ada Okafor (STF-001) |
| Demo customer       | `demo@example.com`    | `demo1234`| customer | David Green (C-002)  |

Admin demo-data actions (see root README "Demo data"):

- `POST /api/admin/demo/load` — add the reference dataset, non-destructive.
- `POST /api/admin/demo/reset?seed=true` — wipe business data, optionally reseed.

## Test / lint

```sh
go test ./...
go vet ./...
```

## Layout

```
cmd/server          entrypoint (flags, seeding, HTTP server)
internal/domain     entity types, status vocabulary, estimate engine, derived KPIs
internal/store      SQLite schema, repository queries, demo seed
internal/auth       argon2id hashing + session tokens
internal/httpapi    JSON routes, middleware, handlers
```

## API

Sessions: opaque random bearer tokens, set as `Set-Cookie: fayfort_session=…`
and/or passed as `Authorization: Bearer <token>`. Customer routes accept any
signed-in session; admin routes additionally require `role == "admin"`.

### Auth & health
| Method | Path | Notes |
|--------|------|-------|
| GET  | `/api/health` | liveness |
| POST | `/api/auth/register` | `{name, email, password}` (≥8 chars) |
| POST | `/api/auth/login` | `{email, password}` → `{token, user, expiresAt}` |
| POST | `/api/auth/logout` | revokes the session |
| GET  | `/api/me` | current user |

### Estimate & marketing
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/estimate/check` | full landed-cost engine (see `domain.ComputeEstimate`) |
| POST | `/api/contact` | `{name, email, message}` |
| POST | `/api/sourcing-requests` | create a request (portal / landing) |

### Admin (role required)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/dashboard` | KPIs, pipeline, charts, activity |
| GET | `/api/admin/requests?q=&status=` | filterable queue |
| GET | `/api/admin/requests/{id}` | detail + timeline + quote + activity |
| PATCH | `/api/admin/requests/{id}/status` | `{status}` (validated) |
| POST | `/api/admin/requests/{id}/quote` | issue a quote (`{supplier, valueUsd, marginBps, status?}`) |
| GET | `/api/admin/quotes` `/orders` `/shipments` `/inspections` `/customers` `/suppliers` | lists |
| GET | `/api/admin/messages` | support threads |
| POST | `/api/admin/messages/{id}/reply` `/read` | thread actions |
| GET / POST | `/api/admin/notifications[/read]` | feed + mark all read |
| GET | `/api/admin/analytics` `/activity` `/search?q=` `/settings` | derived views |

### Customer portal
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/portal/requests` | the user's requests + status timeline |
| GET / POST | `/api/portal/notifications[/read]` | feed + mark all read |
| GET / POST | `/api/portal/thread` | the user's support thread |
| GET | `/api/portal/profile` | identity + customer record |
| GET | `/api/portal/overview` | summary counts |

### Push notifications

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/api/push/public-key` | `{publicKey, enabled}` — VAPID key the browser subscribes with |
| POST | `/api/push/subscribe` | `{endpoint, keys:{p256dh, auth}}` — registers this device for the caller |
| POST | `/api/push/unsubscribe` | `{endpoint}` — removes a device, only if the caller registered it |
| POST | `/api/push/test` | sends a notification to the caller's own devices and returns delivery counts |

Devices are stored in `push_subscriptions` keyed by endpoint, tagged with the
owning account's email and role. Business notifications fan out by role
(`admin` / `customer`); the delivery test fans out by account so a user can
never trigger a notification on someone else's device. Endpoints a push service
reports as `404`/`410` are pruned automatically.

| Variable | Default | Notes |
|----------|---------|-------|
| `FAYFORT_VAPID_PUBLIC_KEY` | generated | Uncompressed P-256 point, base64url |
| `FAYFORT_VAPID_PRIVATE_KEY` | generated | base64url |
| `FAYFORT_VAPID_SUBJECT` | `mailto:support@fayfort.com` | push service contact |
| `FAYFORT_PUSH_TIMEOUT` | `10s` | per-attempt HTTP timeout |

**Set stable keys in production.** Without them the server generates an
ephemeral pair at boot, every existing device subscription stops matching, and
notifications are lost after a restart or a deploy. Generate a pair once and
keep it:

```sh
go run ./cmd/server -h            # flags
# generate a pair with any VAPID tool, e.g.
npx web-push generate-vapid-keys --json
export FAYFORT_VAPID_PUBLIC_KEY=...
export FAYFORT_VAPID_PRIVATE_KEY=...
```

Run with a file-backed database (`-db ./fayfort.db`, the default) so
subscriptions survive a restart; `:memory:` is for tests only.

## Notes

- Storage is deliberately repository-shaped (typed methods over SQL), so a Postgres
  driver can be swapped in later without touching handlers. Currently one
  bottleneck connection keeps SQLite lock behaviour predictable.
- Passwords use argon2id (`golang.org/x/crypto/argon2`); the old frontend mock
  rule (`>= 8 chars`) is preserved as the validation only.
- Push delivery is best-effort: notifications are dispatched in the background
  so a slow push service never delays the action that produced them, transport
  failures are retried a few times, and push service hostnames are dialled over
  IPv4 (a host with no IPv6 route would otherwise fail every send).
- Push requires a secure context in production. Browsers only grant
  `Notification` permission and only deliver to an installed app over HTTPS
  (localhost is exempt), so serve the frontend behind TLS.
- Deferred hardening (rate limiting on login/register, 2FA, honeypot field on
  registration) should land in this service, not the Next prototype.