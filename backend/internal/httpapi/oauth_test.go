package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func stubGoogleTokenInfo(t *testing.T, claims map[string]any) {
	t.Helper()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(claims)
	}))
	t.Cleanup(ts.Close)
	old := googleTokenInfoURL
	googleTokenInfoURL = ts.URL
	t.Cleanup(func() { googleTokenInfoURL = old })
}

func TestGoogleOAuthLinksExistingAdmin(t *testing.T) {
	srv, _, db := newTestServer(t)
	srv.GoogleClientID = "client-id"
	stubGoogleTokenInfo(t, map[string]any{
		"email": "admin@fayfort.com", "email_verified": "true", "name": "Ada Okafor", "aud": "client-id",
	})

	rec, body := doJSON(t, srv.Routes(), "POST", "/api/oauth/google", map[string]string{"idToken": "a.b.c"}, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %v", rec.Code, body)
	}
	if role := body["user"].(map[string]any)["role"]; role != "admin" {
		t.Fatalf("role = %v, want admin", role)
	}
	email := body["user"].(map[string]any)["email"]
	if email != "admin@fayfort.com" {
		t.Fatalf("email = %v", email)
	}

	// The Google sign-in must have issued a working session.
	token := body["token"].(string)
	me, _ := doJSON(t, srv.Routes(), "GET", "/api/me", nil, token)
	if me.Code != http.StatusOK {
		t.Fatalf("me status = %d, want 200 (session not issued)", me.Code)
	}
	_ = db
}

func TestGoogleOAuthProvisionsUnknownEmail(t *testing.T) {
	srv, _, _ := newTestServer(t)
	stubGoogleTokenInfo(t, map[string]any{
		"email": "new@customer.email", "email_verified": "true", "name": "Ngozi Osei", "aud": "",
	})

	rec, body := doJSON(t, srv.Routes(), "POST", "/api/oauth/google", map[string]string{"idToken": "a.b.c"}, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %v", rec.Code, body)
	}
	user := body["user"].(map[string]any)
	if user["role"] != "customer" {
		t.Fatalf("role = %v, want customer", user["role"])
	}
	if user["email"] != "new@customer.email" {
		t.Fatalf("email = %v", user["email"])
	}
}

func TestGoogleOAuthRejectsWrongAudience(t *testing.T) {
	srv, _, _ := newTestServer(t)
	srv.GoogleClientID = "client-id"
	stubGoogleTokenInfo(t, map[string]any{
		"email": "admin@fayfort.com", "email_verified": "true", "name": "Ada", "aud": "some-other-app",
	})

	rec, body := doJSON(t, srv.Routes(), "POST", "/api/oauth/google", map[string]string{"idToken": "a.b.c"}, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401, body = %v", rec.Code, body)
	}
}

func TestGoogleOAuthRejectsUnverifiedEmail(t *testing.T) {
	srv, _, _ := newTestServer(t)
	stubGoogleTokenInfo(t, map[string]any{
		"email": "admin@fayfort.com", "email_verified": "false", "name": "Ada", "aud": "",
	})

	rec, _ := doJSON(t, srv.Routes(), "POST", "/api/oauth/google", map[string]string{"idToken": "a.b.c"}, "")
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

func TestGoogleOAuthSetsSessionCookie(t *testing.T) {
	srv, _, _ := newTestServer(t)
	stubGoogleTokenInfo(t, map[string]any{
		"email": "admin@fayfort.com", "email_verified": "true", "name": "Ada Okafor", "aud": "",
	})

	rec, _ := doJSON(t, srv.Routes(), "POST", "/api/oauth/google", map[string]string{"idToken": "a.b.c"}, "")
	setCookie := rec.Result().Header.Get("Set-Cookie")
	if !strings.Contains(setCookie, "fayfort_session=") || !strings.Contains(setCookie, "Max-Age") {
		t.Fatalf("expected a persistent session cookie, got %q", setCookie)
	}
}
