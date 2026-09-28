#!/usr/bin/env bash
# Boot the Fayfort backend with a fresh in-memory database on :3100.
set -euo pipefail
cd "$(dirname "$0")"
exec go run ./cmd/server -db :memory: -addr 127.0.0.1:3100