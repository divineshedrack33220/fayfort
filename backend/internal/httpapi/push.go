package httpapi

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	"fayfort/backend/internal/domain"
	"fayfort/backend/internal/push"
)

// pushSubscriptionRequest mirrors the JSON shape a browser PushSubscription
// serialises to. Only the fields the push services need are accepted.
type pushSubscriptionRequest struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
	// Subscription allows clients to post the object as-is when it is nested.
	Subscription *pushSubscriptionRequest `json:"subscription"`
}

func (r pushSubscriptionRequest) resolved() pushSubscriptionRequest {
	if r.Subscription != nil {
		return r.Subscription.resolved()
	}
	return r
}

// validate rejects payloads that could never be delivered to, keeping junk out
// of the subscription table.
func (r pushSubscriptionRequest) validate() (endpoint, p256dh, auth string, ok bool) {
	endpoint = strings.TrimSpace(r.Endpoint)
	p256dh = strings.TrimSpace(r.Keys.P256dh)
	auth = strings.TrimSpace(r.Keys.Auth)

	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Host == "" {
		return "", "", "", false
	}
	if parsed.Scheme != "https" && parsed.Hostname() != "localhost" {
		return "", "", "", false
	}
	if len(p256dh) < 20 || len(p256dh) > 256 {
		return "", "", "", false
	}
	if len(auth) < 8 || len(auth) > 64 {
		return "", "", "", false
	}
	return endpoint, p256dh, auth, true
}

// handlePushPublicKey hands the browser the VAPID public key it must subscribe
// with. The key is public by design; the endpoint still requires a session so
// anonymous visitors cannot probe it.
func (s *Server) handlePushPublicKey(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"publicKey": s.Push.PublicKey(),
		"enabled":   s.Push.Ready(),
	})
}

// handlePushSubscribe registers (or refreshes) this device for push.
func (s *Server) handlePushSubscribe(w http.ResponseWriter, r *http.Request) {
	if !s.Push.Ready() {
		writeError(w, http.StatusServiceUnavailable, "push notifications are not configured")
		return
	}
	var body pushSubscriptionRequest
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid subscription payload")
		return
	}
	endpoint, p256dh, auth, ok := body.resolved().validate()
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid subscription payload")
		return
	}

	user := currentUser(r)
	sub := domain.PushSubscription{
		Endpoint:  endpoint,
		P256dh:    p256dh,
		Auth:      auth,
		UserEmail: user.Email,
		UserRole:  user.Role,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if err := s.Store.UpsertPushSubscription(sub); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save subscription")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true})
}

// handlePushUnsubscribe removes a device the user opted out of.
func (s *Server) handlePushUnsubscribe(w http.ResponseWriter, r *http.Request) {
	var body pushSubscriptionRequest
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid subscription payload")
		return
	}
	endpoint := strings.TrimSpace(body.resolved().Endpoint)
	if endpoint == "" {
		writeError(w, http.StatusBadRequest, "invalid subscription payload")
		return
	}
	// Only the account that registered a device may remove it: endpoints are
	// unguessable, but an unsubscribe is still an account-scoped action.
	user := currentUser(r)
	if _, ok, err := s.Store.PushSubscriptionForUser(endpoint, user.Email); err != nil {
		writeError(w, http.StatusInternalServerError, "could not load subscription")
		return
	} else if !ok {
		writeError(w, http.StatusNotFound, "no such subscription for this account")
		return
	}
	if err := s.Store.DeletePushSubscription(endpoint); err != nil {
		writeError(w, http.StatusInternalServerError, "could not remove subscription")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handlePushTest sends a push to the caller's own devices so a user can confirm
// delivery (including with the app closed) without waiting for a real event.
func (s *Server) handlePushTest(w http.ResponseWriter, r *http.Request) {
	if !s.Push.Ready() {
		writeError(w, http.StatusServiceUnavailable, "push notifications are not configured")
		return
	}
	user := currentUser(r)
	dashboard := "/dashboard"
	if user.Role == push.RoleAdmin {
		dashboard = "/admin"
	}
	payload := push.PayloadFor(
		user.Role,
		"Fayfort test notification",
		"Push notifications are working. This is what lands when the app is closed.",
		dashboard,
	)
	payload.Tag = "fayfort-test"
	payload.RequireInteraction = false

	result, err := s.Push.DispatchUserSync(r.Context(), user.Email, payload)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not send test notification")
		return
	}
	if result.Subscriptions == 0 {
		writeError(w, http.StatusBadRequest, "no subscribed devices for this account")
		return
	}
	writeJSON(w, http.StatusOK, result)
}
