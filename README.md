# fayfort

China-to-Africa sourcing platform with transparent landed costs. Customers
sign in with Google in one step; staff manage requests, quotes and inspections
from the admin console.

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind, pnpm
- **Backend:** Go (`backend/cmd/server`), in-memory or SQLite-backed sessions
- **Sign-in:** Google OAuth (ID-token exchange handled in `backend/internal/httpapi/oauth.go`)

## Development

Backend:

```sh
cd backend
GOOGLE_CLIENT_ID=$CLIENT_ID go run ./cmd/server -addr :8080
```

Frontend:

```sh
cd frontend
pnpm install
pnpm dev
```

Set `frontend/.env.local` (gitignored) with `NEXT_PUBLIC_GOOGLE_CLIENT_ID`,
`BACKEND_URL` and any media secrets before starting following the backend.

Tests:

```sh
cd frontend && pnpm test      # vitest
cd backend && go test ./...   # Go suite
```