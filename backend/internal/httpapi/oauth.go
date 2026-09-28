package httpapi

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"fayfort/backend/internal/auth"
	"fayfort/backend/internal/store"
)

// googleTokenInfoURL is Google's ID-token verification endpoint. Overridable
// in tests so the handler can run against a stubbed server.
var googleTokenInfoURL = "https://oauth2.googleapis.com/tokeninfo"

// googleTokenURL is Google's token endpoint, used to exchange an
// authorization code (from the PKCE code flow) for an ID token.
var googleTokenURL = "https://oauth2.googleapis.com/token"

const googleVerifierTimeout = 10 * time.Second

var errInvalidGoogleToken = errors.New("httpapi: invalid Google ID token")
var errGoogleExchange = errors.New("httpapi: Google authorization code exchange failed")

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

// googleIDTokenClaims is the relevant subset of the OpenID Connect claims that
// arrive inside the ID token issued by the token endpoint.
type googleIDTokenClaims struct {
	Iss           string `json:"iss"`
	Sub           string `json:"sub"`
	Aud           string `json:"aud"`
	Exp           int64  `json:"exp"`
	Nonce         string `json:"nonce"`
	Email         string `json:"email"`
	EmailVerified any    `json:"email_verified"`
	Name          string `json:"name"`
}

func (claims googleIDTokenClaims) EmailIsVerified() bool {
	switch v := claims.EmailVerified.(type) {
	case string:
		return v == "true"
	case bool:
		return v
	}
	return false
}

// decodeIDTokenPayload base64-decodes the payload segment of a JWT without
// verifying its signature. Safe here because the token crossed TLS directly
// from Google's token endpoint; the claims themselves are still validated
// (audience, nonce, expiry, issuer).
func decodeIDTokenPayload(idToken string) (googleIDTokenClaims, error) {
	var claims googleIDTokenClaims
	if idToken == "" || strings.Count(idToken, ".") != 2 {
		return claims, errInvalidGoogleToken
	}
	payload, err := base64.RawURLEncoding.DecodeString(strings.Split(idToken, ".")[1])
	if err != nil {
		return claims, errInvalidGoogleToken
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return claims, errInvalidGoogleToken
	}
	return claims, nil
}

// finishGoogleSignIn converts a verified Google identity into a Fayfort
// account (linking or provisioning) and issues the session cookie.
func (s *Server) finishGoogleSignIn(w http.ResponseWriter, email string, emailVerified bool, name string) {
	if !emailVerified {
		writeError(w, http.StatusForbidden, "your Google email is not verified")
		return
	}
	if email == "" {
		writeError(w, http.StatusBadRequest, "Google account has no email")
		return
	}

	user, err := s.Store.UserByEmail(strings.ToLower(email))
	if errors.Is(err, store.ErrNotFound) {
		// Provision a new customer account linked to the Google identity.
		if name == "" {
			name = strings.Split(email, "@")[0]
		}
		randomHash, hasErr := auth.HashPassword("google-" + auth.RandomToken())
		if hasErr != nil {
			writeError(w, http.StatusInternalServerError, "could not provision account")
			return
		}
		user = store.UserRow{
			ID:           "USR-G-" + auth.RandomToken(),
			Name:         name,
			Email:        strings.ToLower(email),
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
	s.finishGoogleSignIn(w, info.Email, info.EmailIsVerified(), info.Name)
}

type googleCodeSignInRequest struct {
	Code         string `json:"code"`
	CodeVerifier string `json:"codeVerifier"`
	Nonce        string `json:"nonce"`
	RedirectURI  string `json:"redirectUri"`
}

// handleGoogleOAuthCode completes the PKCE code flow: the browser never sees
// an ID token (Chrome flags long tokens in URLs), instead it exchanges the
// authorization code and PKCE verifier here, server-side, over TLS.
func (s *Server) handleGoogleOAuthCode(w http.ResponseWriter, r *http.Request) {
	var req googleCodeSignInRequest
	if err := readJSON(r, &req); err != nil || req.Code == "" || req.CodeVerifier == "" || req.RedirectURI == "" {
		writeError(w, http.StatusBadRequest, "missing Google authorization code")
		return
	}
	if s.GoogleClientID == "" || s.GoogleClientSecret == "" {
		writeError(w, http.StatusServiceUnavailable, "Google sign-in is not configured")
		return
	}

	claims, err := s.exchangeGoogleCode(req.Code, req.CodeVerifier, req.RedirectURI)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid Google sign-in")
		return
	}
	// The nonce the browser sent to Google must match the one inside the ID
	// token, otherwise the code exchange could have been replayed.
	if req.Nonce == "" || claims.Nonce != req.Nonce {
		writeError(w, http.StatusUnauthorized, "invalid Google sign-in")
		return
	}
	s.finishGoogleSignIn(w, claims.Email, claims.EmailIsVerified(), claims.Name)
}

// exchangeGoogleCode redeems an authorization code for an ID token using the
// OAuth client secret and the PKCE verifier, then validates the token claims.
func (s *Server) exchangeGoogleCode(code, verifier, redirectURI string) (googleIDTokenClaims, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("client_id", s.GoogleClientID)
	form.Set("client_secret", s.GoogleClientSecret)
	form.Set("redirect_uri", redirectURI)
	form.Set("code_verifier", verifier)

	client := &http.Client{Timeout: googleVerifierTimeout}
	res, err := client.PostForm(googleTokenURL, form)
	if err != nil {
		return googleIDTokenClaims{}, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return googleIDTokenClaims{}, errGoogleExchange
	}
	var payload struct {
		IDToken string `json:"id_token"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return googleIDTokenClaims{}, err
	}
	claims, err := decodeIDTokenPayload(payload.IDToken)
	if err != nil {
		return googleIDTokenClaims{}, err
	}
	// The token must belong to our OAuth client.
	if s.GoogleClientID != "" && claims.Aud != s.GoogleClientID {
		return googleIDTokenClaims{}, errInvalidGoogleToken
	}
	// Reject expired tokens.
	if claims.Exp != 0 && time.Now().Add(5*time.Minute).Unix() >= claims.Exp {
		return googleIDTokenClaims{}, errInvalidGoogleToken
	}
	// Only accept Google-issued identity tokens.
	if iss := claims.Iss; iss != "" && iss != "https://accounts.google.com" && iss != "accounts.google.com" {
		return googleIDTokenClaims{}, errInvalidGoogleToken
	}
	return claims, nil
}
