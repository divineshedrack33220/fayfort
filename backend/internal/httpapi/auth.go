package httpapi

import (
	"errors"
	"net/http"
	"time"

	"fayfort/backend/internal/auth"
	"fayfort/backend/internal/store"
)

const sessionTTL = 7 * 24 * time.Hour

type sessionPayload struct {
	OK        bool   `json:"ok"`
	Token     string `json:"token"`
	User      any    `json:"user"`
	ExpiresAt string `json:"expiresAt"`
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "service": "fayfort-backend"})
}

type registerRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if !auth.EmailValid(req.Email) {
		writeError(w, http.StatusBadRequest, "invalid email address")
		return
	}
	if !auth.PasswordValid(req.Password) {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	if _, err := s.Store.UserByEmail(req.Email); err == nil {
		writeError(w, http.StatusConflict, "an account with this email already exists")
		return
	} else if !errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusInternalServerError, "could not check account")
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not secure password")
		return
	}
	user := store.UserRow{
		ID:           "USR-" + time.Now().Format("20060102-150405"),
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: hash,
		Role:         "customer",
		Status:       "ACTIVE",
		CreatedAt:    time.Now().UTC().Format(time.RFC3339),
	}
	if err := s.Store.CreateUser(user); err != nil {
		writeError(w, http.StatusInternalServerError, "could not create account")
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
	writeJSON(w, http.StatusCreated, sessionPayload{
		OK: true, Token: token, ExpiresAt: time.Now().Add(sessionTTL).UTC().Format(time.RFC3339),
		User: map[string]any{"id": user.ID, "name": user.Name, "email": user.Email, "role": user.Role, "status": user.Status},
	})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	user, err := s.Store.UserByEmail(req.Email)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not look up account")
		return
	}
	if user.Status == "DEACTIVATED" {
		writeError(w, http.StatusForbidden, "this account is deactivated")
		return
	}
	ok, err := auth.VerifyPassword(user.PasswordHash, req.Password)
	if err != nil || !ok {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
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

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(CookieName); err == nil && cookie.Value != "" {
		_ = s.Store.DeleteSession(cookie.Value)
	}
	if auth := r.Header.Get("Authorization"); len(auth) > 7 {
		_ = s.Store.DeleteSession(auth[7:])
	}
	http.SetCookie(w, &http.Cookie{
		Name: CookieName, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"user": map[string]any{"id": user.ID, "name": user.Name, "email": user.Email, "role": user.Role, "status": user.Status},
	})
}

func (s *Server) setSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(sessionTTL.Seconds()),
	})
}
