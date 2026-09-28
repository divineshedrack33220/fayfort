// Package httpapi exposes the Fayfort domain as a JSON HTTP API.
//
// Routes mirror the frontend prototype's pages and existing /api/auth/* and
// /api/health contracts. Admin endpoints require an admin session; customer
// endpoints require any signed-in session.
package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"fayfort/backend/internal/domain"
	"fayfort/backend/internal/push"
	"fayfort/backend/internal/store"
)

// CookieName matches the frontend prototype's session cookie.
const CookieName = "fayfort_session"

// ctxKey is the typed key for the authenticated user.
type ctxKey struct{}

// Server holds dependencies for all handlers.
type Server struct {
	Store *store.DB
	Log   *log.Logger
	Push  *push.Dispatcher
	hub   *wsHub

	// GoogleClientID is the OAuth client the frontend signs in with. When set,
	// Google ID tokens are rejected unless their audience matches it.
	GoogleClientID string

	// GoogleClientSecret is used server-side to exchange PKCE authorization
	// codes for tokens. Never exposed to the browser.
	GoogleClientSecret string

	wsMu     sync.Mutex
	wsTokens map[string]wsTokenEntry
}

// New builds a server with all routes registered.
func New(s *store.DB, l *log.Logger, googleClientID, googleClientSecret string) *Server {
	sender, generated := push.NewSender(l)
	if generated {
		l.Printf("push: using an ephemeral VAPID keypair; set %s and %s so push keeps working across restarts",
			push.EnvPublicKey, push.EnvPrivateKey)
	}
	srv := &Server{
		Store:              s,
		Log:                l,
		Push:               push.NewDispatcher(sender, s, l),
		hub:                newWSHub(),
		wsTokens:           make(map[string]wsTokenEntry),
		GoogleClientID:     googleClientID,
		GoogleClientSecret: googleClientSecret,
	}
	go srv.pruneWSTokens()
	return srv
}

// pruneWSTokens drops expired socket tokens so a long-lived server never
// accumulates stale entries.
func (s *Server) pruneWSTokens() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for now := range ticker.C {
		s.wsMu.Lock()
		for token, entry := range s.wsTokens {
			if now.After(entry.expires) {
				delete(s.wsTokens, token)
			}
		}
		s.wsMu.Unlock()
	}
}

// Routes returns the fully-wired http.Handler.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", s.handleHealth)

	mux.HandleFunc("POST /api/auth/register", s.handleRegister)
	mux.HandleFunc("POST /api/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)
	mux.HandleFunc("POST /api/oauth/google", s.handleGoogleOAuth)
	mux.HandleFunc("POST /api/oauth/google/code", s.handleGoogleOAuthCode)
	mux.HandleFunc("GET /api/me", s.requireAuth(s.handleMe))

	// Web Push
	mux.HandleFunc("GET /api/push/public-key", s.requireAuth(s.handlePushPublicKey))
	mux.HandleFunc("POST /api/push/subscribe", s.requireAuth(s.handlePushSubscribe))
	mux.HandleFunc("POST /api/push/unsubscribe", s.requireAuth(s.handlePushUnsubscribe))
	mux.HandleFunc("POST /api/push/test", s.requireAuth(s.handlePushTest))

	mux.HandleFunc("POST /api/estimate/check", s.handleEstimate)
	mux.HandleFunc("POST /api/estimate/simplified", s.handleSimplifiedEstimate)
	mux.HandleFunc("POST /api/contact", s.handleContact)
	mux.HandleFunc("POST /api/sourcing-requests", s.handleCreateRequest)

	// Customer portal
	mux.HandleFunc("GET /api/portal/requests", s.requireCustomer(s.handlePortalRequests))
	mux.HandleFunc("GET /api/portal/quotes", s.requireCustomer(s.handlePortalQuotes))
	mux.HandleFunc("POST /api/portal/quotes/{requestId}/decision", s.requireCustomer(s.handlePortalQuoteDecision))
	mux.HandleFunc("GET /api/portal/notifications", s.requireCustomer(s.handlePortalNotifications))
	mux.HandleFunc("POST /api/portal/notifications/read", s.requireCustomer(s.handlePortalNotificationsRead))
	mux.HandleFunc("POST /api/portal/notifications/{id}/read", s.requireCustomer(s.handlePortalNotificationRead))
	mux.HandleFunc("GET /api/portal/thread", s.requireCustomer(s.handlePortalThread))
	mux.HandleFunc("POST /api/portal/thread", s.requireCustomer(s.handlePortalThreadPost))
	mux.HandleFunc("GET /api/portal/thread/unread", s.requireCustomer(s.handlePortalThreadUnread))
	mux.HandleFunc("POST /api/portal/thread/read", s.requireCustomer(s.handlePortalThreadRead))
	mux.HandleFunc("GET /api/portal/profile", s.requireCustomer(s.handlePortalProfile))
	mux.HandleFunc("GET /api/portal/overview", s.requireCustomer(s.handlePortalOverview))
	mux.HandleFunc("GET /api/ws", s.handleWS)
	mux.HandleFunc("POST /api/ws-token", s.requireAuth(s.handleWSToken))

	// Admin
	mux.HandleFunc("GET /api/admin/dashboard", s.requireAdmin(s.handleAdminDashboard))
	mux.HandleFunc("GET /api/admin/requests", s.requireAdmin(s.handleListRequests))
	mux.HandleFunc("GET /api/admin/requests/{id}", s.requireAdmin(s.handleRequestDetail))
	mux.HandleFunc("PATCH /api/admin/requests/{id}/status", s.requireAdmin(s.handleUpdateRequestStatus))
	mux.HandleFunc("POST /api/admin/requests/{id}/quote", s.requireAdmin(s.handleIssueQuote))
	mux.HandleFunc("GET /api/admin/quotes", s.requireAdmin(s.handleListQuotes))
	mux.HandleFunc("GET /api/admin/orders", s.requireAdmin(s.handleListOrders))
	mux.HandleFunc("POST /api/admin/orders/{id}/advance", s.requireAdmin(s.handleAdvanceOrder))
	mux.HandleFunc("PUT /api/admin/orders/{id}/status", s.requireAdmin(s.handleSetOrderStatus))
	mux.HandleFunc("GET /api/admin/shipments", s.requireAdmin(s.handleListShipments))
	mux.HandleFunc("GET /api/admin/inspections", s.requireAdmin(s.handleListInspections))
	mux.HandleFunc("GET /api/admin/customers", s.requireAdmin(s.handleListCustomers))
	mux.HandleFunc("GET /api/admin/suppliers", s.requireAdmin(s.handleListSuppliers))
	mux.HandleFunc("GET /api/admin/messages", s.requireAdmin(s.handleListThreads))
	mux.HandleFunc("GET /api/admin/messages/unread", s.requireAdmin(s.handleThreadUnreadTotal))
	mux.HandleFunc("POST /api/admin/messages/{id}/reply", s.requireAdmin(s.handleThreadReply))
	mux.HandleFunc("POST /api/admin/messages/{id}/read", s.requireAdmin(s.handleThreadRead))
	mux.HandleFunc("GET /api/admin/notifications", s.requireAdmin(s.handleAdminNotifications))
	mux.HandleFunc("POST /api/admin/notifications/read", s.requireAdmin(s.handleAdminNotificationsRead))
	mux.HandleFunc("POST /api/admin/notifications/{id}/read", s.requireAdmin(s.handleAdminNotificationRead))
	mux.HandleFunc("GET /api/admin/analytics", s.requireAdmin(s.handleAnalytics))
	mux.HandleFunc("GET /api/admin/activity", s.requireAdmin(s.handleActivity))
	mux.HandleFunc("GET /api/admin/search", s.requireAdmin(s.handleSearch))
	mux.HandleFunc("GET /api/admin/settings", s.requireAdmin(s.handleSettings))

	return s.withRecover(logMiddleware(mux))
}

// ---------------------------------------------------------------------------
// Response helpers

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{"ok": false, "error": message})
}

func readJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	return dec.Decode(dst)
}

// cleanAttachments normalizes incoming chat attachments, keeping only image or
// video entries with a real URL so consumers can rely on the shape.
func cleanAttachments(atts []domain.ThreadAttachment) []domain.ThreadAttachment {
	out := make([]domain.ThreadAttachment, 0, len(atts))
	for _, att := range atts {
		if att.URL = strings.TrimSpace(att.URL); att.URL == "" {
			continue
		}
		switch att.Kind {
		case "image", "video":
			out = append(out, att)
		}
	}
	return out
}

// ---------------------------------------------------------------------------
// Middleware

func logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		// nolint:logfmt — simple line for standalone dev tooling
		log.Printf("%s %s (%s)", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}

func (s *Server) withRecover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				if s.Log != nil {
					s.Log.Printf("panic on %s %s: %v", r.Method, r.URL.Path, rec)
				}
				writeError(w, http.StatusInternalServerError, "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// userFromRequest resolves the signed-in user from cookie or bearer token.
func (s *Server) userFromRequest(r *http.Request) (store.UserRow, bool, error) {
	token := ""
	if cookie, err := r.Cookie(CookieName); err == nil && cookie.Value != "" {
		token = cookie.Value
	}
	if token == "" {
		if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
			token = strings.TrimPrefix(auth, "Bearer ")
		}
	}
	if token == "" {
		return store.UserRow{}, false, nil
	}
	user, err := s.Store.SessionUser(token)
	if err != nil {
		return store.UserRow{}, false, err
	}
	return user, true, nil
}

func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok, err := s.userFromRequest(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid session")
			return
		}
		if !ok {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		ctx := context.WithValue(r.Context(), ctxKey{}, user)
		next(w, r.WithContext(ctx))
	}
}

func (s *Server) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return s.requireAuth(func(w http.ResponseWriter, r *http.Request) {
		user, _ := r.Context().Value(ctxKey{}).(store.UserRow)
		if user.Role != "admin" {
			writeError(w, http.StatusForbidden, "admin access required")
			return
		}
		next(w, r)
	})
}

func (s *Server) requireCustomer(next http.HandlerFunc) http.HandlerFunc {
	return s.requireAuth(func(w http.ResponseWriter, r *http.Request) {
		user, _ := r.Context().Value(ctxKey{}).(store.UserRow)
		if user.Role == "" {
			writeError(w, http.StatusForbidden, "customer access required")
			return
		}
		next(w, r)
	})
}

// currentUser is a tiny helper for handlers.
func currentUser(r *http.Request) store.UserRow {
	u, _ := r.Context().Value(ctxKey{}).(store.UserRow)
	return u
}
