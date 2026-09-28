package httpapi

import (
	"io"
	"log"
	"net/http"
	"testing"

	"fayfort/backend/internal/auth"
	"fayfort/backend/internal/store"
)

func newEmptyTestServer(t *testing.T) (*Server, *store.DB) {
	t.Helper()
	db, err := store.Open(":memory:")
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	hash, err := auth.HashPassword("admin123")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if err := db.CreateUser(store.UserRow{
		ID: "USR-ADM-001", Name: "Ada Okafor", Email: "admin@fayfort.com",
		PasswordHash: hash, Role: "admin", Status: "ACTIVE",
	}); err != nil {
		t.Fatalf("admin user: %v", err)
	}
	return New(db, log.New(io.Discard, "", 0), "", ""), db
}

func TestAdminDemoEndpointsRequireAdmin(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()

	for _, path := range []string{"/api/admin/demo/load", "/api/admin/demo/reset"} {
		// Unauthenticated.
		rec, _ := doJSON(t, handler, http.MethodPost, path, nil, "")
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s unauthenticated -> %d, want 401", path, rec.Code)
		}
		// Authenticated but not an admin.
		customer := login(t, handler, "demo@example.com", "demo1234")
		rec, _ = doJSON(t, handler, http.MethodPost, path, nil, customer)
		if rec.Code != http.StatusForbidden {
			t.Errorf("%s customer -> %d, want 403", path, rec.Code)
		}
	}
}

func TestAdminDemoLoad(t *testing.T) {
	srv, db := newEmptyTestServer(t)
	handler := srv.Routes()
	admin := login(t, handler, "admin@fayfort.com", "admin123")

	rec, payload := doJSON(t, handler, http.MethodPost, "/api/admin/demo/load", nil, admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("load -> %d: %s", rec.Code, rec.Body.String())
	}
	tables, _ := payload["tables"].(map[string]any)
	if tables == nil {
		t.Fatalf("load response missing tables: %v", payload)
	}
	if n, _ := tables["customers"].(float64); n < 1 {
		t.Errorf("expected customers seeded, got %v", tables["customers"])
	}
	if n, _ := tables["sourcing_requests"].(float64); n < 1 {
		t.Errorf("expected sourcing_requests seeded, got %v", tables["sourcing_requests"])
	}

	// Idempotent: a second load against a populated database still succeeds.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/admin/demo/load", nil, admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("second load -> %d: %s", rec.Code, rec.Body.String())
	}
	if _, err := db.UserByEmail("admin@fayfort.com"); err != nil {
		t.Errorf("account must survive load: %v", err)
	}
}

func TestAdminDemoReset(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()
	admin := login(t, handler, "admin@fayfort.com", "admin123")

	rec, payload := doJSON(t, handler, http.MethodPost, "/api/admin/demo/reset", nil, admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("reset -> %d: %s", rec.Code, rec.Body.String())
	}
	deleted, _ := payload["deleted"].(map[string]any)
	if deleted == nil || deleted["sourcing_requests"].(float64) < 1 {
		t.Fatalf("reset should have deleted seeded rows: %v", payload)
	}

	// Console now shows an empty pipeline.
	rec, payload = doJSON(t, handler, http.MethodGet, "/api/admin/requests", nil, admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("requests -> %d: %s", rec.Code, rec.Body.String())
	}
	requests, _ := payload["requests"].([]any)
	if len(requests) != 0 {
		t.Errorf("expected 0 requests after reset, got %d", len(requests))
	}

	// The caller's session survived the reset (accounts & sessions are kept).
	rec, _ = doJSON(t, handler, http.MethodGet, "/api/me", nil, admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("session lost after reset: %d", rec.Code)
	}

	// Reseeding on demand brings the demo dataset back.
	rec, payload = doJSON(t, handler, http.MethodPost, "/api/admin/demo/reset?seed=true", nil, admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("reset?seed=true -> %d: %s", rec.Code, rec.Body.String())
	}
	rec, payload = doJSON(t, handler, http.MethodGet, "/api/admin/requests", nil, admin)
	requests, _ = payload["requests"].([]any)
	if len(requests) == 0 {
		t.Errorf("expected requests after reset?seed=true")
	}
}