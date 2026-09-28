package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"fayfort/backend/internal/auth"
	"fayfort/backend/internal/store"
)

// googleTokenInfoURL is Google's ID-token verification endpoint. Overridable
// in tests so the handler can run against a stubbed server.
var googleTokenInfoURL = "https://oauth2.googleapis.com/tokeninfo"

const googleVerifierTimeout = 10 * time.Second

var errInvalidGoogleToken = errors.New("httpapi: invalid Google ID token")

type googleTokenInfo struct {
	Email         string `json:"email"`
	EmailVerified any    `json:"email_verified"`
	Name          string `json:"name"`
	Aud           string `json:"aud"`
}

func (info googleTokenInfo) EmailIsVerified() bool {
	switch v := info.EmailVerified.(type) {
	case string:
		return v == "true"
	case bool:
		return v
	}
	return false
}

// verifyGoogleIDToken calls Google's tokeninfo endpoint to validate a signed
// ID token issued to our OAuth client. Returns the verified claims, or an
// error when the token is invalid or belongs to another client.
func (s *Server) verifyGoogleIDToken(idToken string) (googleTokenInfo, error) {
	var info googleTokenInfo
	if idToken == "" || strings.Count(idToken, ".") != 2 {
		return info, errInvalidGoogleToken
	}

	client := &http.Client{Timeout: googleVerifierTimeout}
	res, err := client.Get(googleTokenInfoURL + "?id_token=" + idToken)
	if err != nil {
		return info, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return info, errInvalidGoogleToken
	}
	if err := json.NewDecoder(res.Body).Decode(&info); err != nil {
		return info, err
	}
	// The token must have been minted for OUR OAuth client, otherwise a token
	// from some other app would let anyone log in here.
	if s.GoogleClientID != "" && info.Aud != s.GoogleClientID {
		return info, errInvalidGoogleToken
	}
	return info, nil
}

type googleSignInRequest struct {
	IDToken string `json:"idToken"`
}

// handleGoogleOAuth is the one-click "Sign in with Google" entry point. It
// verifies the ID token, links the Google account to an existing Fayfort user
// with the same email (or provisions a new customer), then issues the normal
// Fayfort session cookie. New accounts get a random, unusable password hash so
// they can never be signed into via the password form.
func (s *Server) handleGoogleOAuth(w http.ResponseWriter, r *http.Request) {
	var req googleSignInRequest
	if err := readJSON(r, &req); err != nil || req.IDToken == "" {
		writeError(w, http.StatusBadRequest, "missing Google credential")
		return
	}

	info, err := s.verifyGoogleIDToken(req.IDToken)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid Google sign-in")
		return
	}
	if !info.EmailIsVerified() {
		writeError(w, http.StatusForbidden, "your Google email is not verified")
		return
	}
	if info.Email == "" {
		writeError(w, http.StatusBadRequest, "Google account has no email")
		return
	}

	user, err := s.Store.UserByEmail(strings.ToLower(info.Email))
	if errors.Is(err, store.ErrNotFound) {
		// Provision a new customer account linked to the Google identity.
		name := info.Name
		if name == "" {
			name = strings.Split(info.Email, "@")[0]
		}
		randomHash, hasErr := auth.HashPassword("google-" + auth.RandomToken())
		if hasErr != nil {
			writeError(w, http.StatusInternalServerError, "could not provision account")
			return
		}
		user = store.UserRow{
			ID:           "USR-G-" + auth.RandomToken(),
			Name:         name,
			Email:        strings.ToLower(info.Email),
			PasswordHash: randomHash,
			Role:         "customer",
			Status:       "ACTIVE",
			CreatedAt:    time.Now().UTC().Format(time.RFC3339),
		}
		if err := s.Store.CreateUser(user); err != nil {
			writeError(w, http.StatusInternalServerError, "could not create account")
			return
		}
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not look up account")
		return
	}

	if user.Status == "DEACTIVATED" {
		writeError(w, http.StatusForbidden, "this account is deactivated")
		return
	}

	token, err := auth.NewToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not issue session")
		return
	}
	if err := s.Store.CreateSession(token, user.ID, sessionTTL); err != nil {
		writeError(w, http.StatusInternalServerError, "could not create session")
		return
	}
	s.setSessionCookie(w, token)
	writeJSON(w, http.StatusOK, sessionPayload{
		OK: true, Token: token, ExpiresAt: time.Now().Add(sessionTTL).UTC().Format(time.RFC3339),
		User: map[string]any{"id": user.ID, "name": user.Name, "email": user.Email, "role": user.Role, "status": user.Status},
	})
}
