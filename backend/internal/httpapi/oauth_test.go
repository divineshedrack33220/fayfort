package httpapi

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
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

func b64urlJSON(t *testing.T, v any) string {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return base64.RawURLEncoding.EncodeToString(raw)
}

func fakeGoogleIDToken(t *testing.T, claims map[string]any) string {
	t.Helper()
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","typ":"JWT"}`))
	return header + "." + b64urlJSON(t, claims) + ".sig"
}

func stubGoogleTokenExchange(t *testing.T, idToken string, status int) *httptest.Server {
	t.Helper()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		if idToken != "" {
			_ = json.NewEncoder(w).Encode(map[string]string{"id_token": idToken})
		}
	}))
	t.Cleanup(ts.Close)
	old := googleTokenURL
	googleTokenURL = ts.URL
	t.Cleanup(func() { googleTokenURL = old })
	return ts
}

func codeClaims(email, aud, nonce string) map[string]any {
	return map[string]any{
		"iss": "https://accounts.google.com", "aud": aud, "email": email,
		"email_verified": "true", "name": "Ada Okafor", "nonce": nonce,
		"exp": time.Now().Add(time.Hour).Unix(),
	}
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

func codeExchangeBody(code string) map[string]string {
	return map[string]string{
		"code": code, "codeVerifier": "verifier", "nonce": "nonce-123",
		"redirectUri": "https://fayfort-web.onrender.com/auth/callback",
	}
}

func TestGoogleOAuthCodeFlowExchangesAndSignsIn(t *testing.T) {
	srv, _, _ := newTestServer(t)
	srv.GoogleClientID = "client-id"
	srv.GoogleClientSecret = "client-secret"
	stubGoogleTokenExchange(t, fakeGoogleIDToken(t, codeClaims("admin@fayfort.com", "client-id", "nonce-123")), http.StatusOK)

	rec, body := doJSON(t, srv.Routes(), "POST", "/api/oauth/google/code", codeExchangeBody("auth-code"), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %v", rec.Code, body)
	}
	if role := body["user"].(map[string]any)["role"]; role != "admin" {
		t.Fatalf("role = %v, want admin", role)
	}

	token := body["token"].(string)
	me, _ := doJSON(t, srv.Routes(), "GET", "/api/me", nil, token)
	if me.Code != http.StatusOK {
		t.Fatalf("me status = %d, want 200 (session not issued)", me.Code)
	}
	if setCookie := rec.Result().Header.Get("Set-Cookie"); !strings.Contains(setCookie, "fayfort_session=") {
		t.Fatalf("expected a session cookie, got %q", setCookie)
	}
}

func TestGoogleOAuthCodeFlowProvisionsUnknownCustomer(t *testing.T) {
	srv, _, _ := newTestServer(t)
	srv.GoogleClientID = "client-id"
	srv.GoogleClientSecret = "client-secret"
	stubGoogleTokenExchange(t, fakeGoogleIDToken(t, codeClaims("new@customer.email", "client-id", "nonce-123")), http.StatusOK)

	rec, body := doJSON(t, srv.Routes(), "POST", "/api/oauth/google/code", codeExchangeBody("auth-code"), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %v", rec.Code, body)
	}
	if user := body["user"].(map[string]any); user["role"] != "customer" {
		t.Fatalf("role = %v, want customer", user["role"])
	}
}

func TestGoogleOAuthCodeFlowRejectsMismatchedNonce(t *testing.T) {
	srv, _, _ := newTestServer(t)
	srv.GoogleClientID = "client-id"
	srv.GoogleClientSecret = "client-secret"
	stubGoogleTokenExchange(t, fakeGoogleIDToken(t, codeClaims("admin@fayfort.com", "client-id", "different-nonce")), http.StatusOK)

	rec, _ := doJSON(t, srv.Routes(), "POST", "/api/oauth/google/code", codeExchangeBody("auth-code"), "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestGoogleOAuthCodeFlowRejectsWrongAudience(t *testing.T) {
	srv, _, _ := newTestServer(t)
	srv.GoogleClientID = "client-id"
	srv.GoogleClientSecret = "client-secret"
	stubGoogleTokenExchange(t, fakeGoogleIDToken(t, codeClaims("admin@fayfort.com", "some-other-app", "nonce-123")), http.StatusOK)

	rec, _ := doJSON(t, srv.Routes(), "POST", "/api/oauth/google/code", codeExchangeBody("auth-code"), "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestGoogleOAuthCodeFlowRejectsExpiredToken(t *testing.T) {
	srv, _, _ := newTestServer(t)
	srv.GoogleClientID = "client-id"
	srv.GoogleClientSecret = "client-secret"
	claims := codeClaims("admin@fayfort.com", "client-id", "nonce-123")
	claims["exp"] = time.Now().Add(-time.Hour).Unix()
	stubGoogleTokenExchange(t, fakeGoogleIDToken(t, claims), http.StatusOK)

	rec, _ := doJSON(t, srv.Routes(), "POST", "/api/oauth/google/code", codeExchangeBody("auth-code"), "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestGoogleOAuthCodeFlowRequiresSecret(t *testing.T) {
	srv, _, _ := newTestServer(t)
	srv.GoogleClientID = "client-id"
	srv.GoogleClientSecret = ""
	stubGoogleTokenExchange(t, fakeGoogleIDToken(t, codeClaims("admin@fayfort.com", "client-id", "nonce-123")), http.StatusOK)

	rec, _ := doJSON(t, srv.Routes(), "POST", "/api/oauth/google/code", codeExchangeBody("auth-code"), "")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

func TestGoogleOAuthCodeFlowRejectsFailedExchange(t *testing.T) {
	srv, _, _ := newTestServer(t)
	srv.GoogleClientID = "client-id"
	srv.GoogleClientSecret = "client-secret"
	stubGoogleTokenExchange(t, "", http.StatusBadRequest)

	rec, _ := doJSON(t, srv.Routes(), "POST", "/api/oauth/google/code", codeExchangeBody("auth-code"), "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}
