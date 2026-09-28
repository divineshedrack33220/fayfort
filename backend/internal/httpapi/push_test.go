package httpapi

import (
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
	"unicode/utf8"

	"fayfort/backend/internal/domain"
	"fayfort/backend/internal/push"
)

// pushRecorder is a stand-in for a browser push service.
type pushRecorder struct {
	mu       sync.Mutex
	server   *httptest.Server
	requests []*http.Request
	bodies   [][]byte
}

func newPushRecorder(t *testing.T) *pushRecorder {
	t.Helper()
	rec := &pushRecorder{}
	rec.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		rec.mu.Lock()
		rec.requests = append(rec.requests, r.Clone(r.Context()))
		rec.bodies = append(rec.bodies, body)
		rec.mu.Unlock()
		w.WriteHeader(http.StatusCreated)
	}))
	t.Cleanup(rec.server.Close)
	return rec
}

func (p *pushRecorder) subscribe(t *testing.T, db interface {
	UpsertPushSubscription(domain.PushSubscription) error
}, email, role string) {
	t.Helper()
	p.subscribeDevice(t, db, p.server.URL+"/push/abc", email, role)
}

func (p *pushRecorder) subscribeDevice(t *testing.T, db interface {
	UpsertPushSubscription(domain.PushSubscription) error
}, endpoint, email, role string) {
	t.Helper()
	sender, _ := push.NewSender(log.New(io.Discard, "", 0))
	publicKey := sender.PublicKey()
	if publicKey == "" {
		t.Fatal("no VAPID public key generated")
	}
	err := db.UpsertPushSubscription(domain.PushSubscription{
		Endpoint:  endpoint,
		P256dh:    publicKey,
		Auth:      "AAAAAAAAAAAAAAAAAAAAAA",
		UserEmail: email,
		UserRole:  role,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
}

func (p *pushRecorder) count() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return len(p.requests)
}

func (p *pushRecorder) last() (*http.Request, []byte) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if len(p.requests) == 0 {
		return nil, nil
	}
	return p.requests[len(p.requests)-1], p.bodies[len(p.bodies)-1]
}

func (p *pushRecorder) waitFor(t *testing.T, want int) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if p.count() >= want {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("expected %d push deliveries, got %d", want, p.count())
}

func TestPushPublicKeyRequiresAuth(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()

	rec, _ := doJSON(t, handler, http.MethodGet, "/api/push/public-key", nil, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated -> %d, want 401", rec.Code)
	}
}

func TestPushPublicKeyExposesVapidKey(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()
	token := login(t, handler, "demo@example.com", "demo1234")

	rec, payload := doJSON(t, handler, http.MethodGet, "/api/push/public-key", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("public-key -> %d: %s", rec.Code, rec.Body.String())
	}
	if payload["publicKey"] == "" || payload["enabled"] != true {
		t.Fatalf("payload = %v", payload)
	}
	// The client needs this key verbatim to create a subscription.
	if got := payload["publicKey"].(string); len(got) < 20 {
		t.Fatalf("public key looks wrong: %q", got)
	}
}

func TestPushSubscribeStoresSubscriptionForTheSignedInUser(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	token := login(t, handler, "demo@example.com", "demo1234")

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/push/subscribe", map[string]any{
		"endpoint": "https://fcm.googleapis.com/fcm/send/device-1",
		"keys": map[string]string{
			"p256dh": strings.Repeat("A", 87),
			"auth":   "AAAAAAAAAAAAAAAAAAAAAA",
		},
	}, token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("subscribe -> %d: %s", rec.Code, rec.Body.String())
	}

	subs, err := db.PushSubscriptionsByRole("customer")
	if err != nil {
		t.Fatalf("subscriptions: %v", err)
	}
	if len(subs) != 1 {
		t.Fatalf("subscriptions = %d, want 1", len(subs))
	}
	if subs[0].UserEmail != "demo@example.com" || subs[0].UserRole != "customer" {
		t.Fatalf("subscription owner = %+v", subs[0])
	}
	if subs[0].Endpoint != "https://fcm.googleapis.com/fcm/send/device-1" {
		t.Fatalf("endpoint = %q", subs[0].Endpoint)
	}

	// Re-subscribing the same device refreshes rather than duplicating.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/push/subscribe", map[string]any{
		"endpoint": "https://fcm.googleapis.com/fcm/send/device-1",
		"keys": map[string]string{
			"p256dh": strings.Repeat("B", 87),
			"auth":   "BBBBBBBBBBBBBBBBBBBBBB",
		},
	}, token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("re-subscribe -> %d", rec.Code)
	}
	subs, _ = db.PushSubscriptionsByRole("customer")
	if len(subs) != 1 || subs[0].P256dh != strings.Repeat("B", 87) {
		t.Fatalf("subscription was not refreshed: %+v", subs)
	}
}

func TestPushSubscribeAcceptsNestedSubscription(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	token := login(t, handler, "demo@example.com", "demo1234")

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/push/subscribe", map[string]any{
		"subscription": map[string]any{
			"endpoint": "https://updates.push.services.mozilla.com/wpush/v2/abc",
			"keys": map[string]string{
				"p256dh": strings.Repeat("A", 87),
				"auth":   "AAAAAAAAAAAAAAAAAAAAAA",
			},
		},
	}, token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("subscribe -> %d: %s", rec.Code, rec.Body.String())
	}
	subs, _ := db.PushSubscriptionsByRole("customer")
	if len(subs) != 1 {
		t.Fatalf("subscriptions = %d, want 1", len(subs))
	}
}

func TestPushSubscribeRejectsIncompletePayloads(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	token := login(t, handler, "demo@example.com", "demo1234")

	cases := map[string]map[string]any{
		"missing endpoint": {"keys": map[string]string{"p256dh": strings.Repeat("A", 87), "auth": "AAAAAAAAAAAAAAAAAAAAAA"}},
		"not a url":        {"endpoint": "nonsense", "keys": map[string]string{"p256dh": strings.Repeat("A", 87), "auth": "AAAAAAAAAAAAAAAAAAAAAA"}},
		"insecure scheme":  {"endpoint": "http://push.example/abc", "keys": map[string]string{"p256dh": strings.Repeat("A", 87), "auth": "AAAAAAAAAAAAAAAAAAAAAA"}},
		"missing keys":     {"endpoint": "https://push.example/abc"},
		"short p256dh":     {"endpoint": "https://push.example/abc", "keys": map[string]string{"p256dh": "tiny", "auth": "AAAAAAAAAAAAAAAAAAAAAA"}},
		"short auth":       {"endpoint": "https://push.example/abc", "keys": map[string]string{"p256dh": strings.Repeat("A", 87), "auth": "tiny"}},
	}
	for name, body := range cases {
		rec, _ := doJSON(t, handler, http.MethodPost, "/api/push/subscribe", body, token)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s -> %d, want 400", name, rec.Code)
		}
	}
	subs, _ := db.PushSubscriptionsByRole("customer")
	if len(subs) != 0 {
		t.Fatalf("invalid payloads were stored: %+v", subs)
	}
}

func TestPushSubscribeRequiresAuth(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/push/subscribe", map[string]any{
		"endpoint": "https://push.example/abc",
		"keys":     map[string]string{"p256dh": strings.Repeat("A", 87), "auth": "AAAAAAAAAAAAAAAAAAAAAA"},
	}, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated -> %d, want 401", rec.Code)
	}
}

func TestPushUnsubscribeRemovesDevice(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	token := login(t, handler, "demo@example.com", "demo1234")

	doJSON(t, handler, http.MethodPost, "/api/push/subscribe", map[string]any{
		"endpoint": "https://push.example/abc",
		"keys":     map[string]string{"p256dh": strings.Repeat("A", 87), "auth": "AAAAAAAAAAAAAAAAAAAAAA"},
	}, token)

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/push/unsubscribe", map[string]any{
		"endpoint": "https://push.example/abc",
	}, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("unsubscribe -> %d: %s", rec.Code, rec.Body.String())
	}
	subs, _ := db.PushSubscriptionsByRole("customer")
	if len(subs) != 0 {
		t.Fatalf("subscription survived unsubscribe: %+v", subs)
	}

	rec, _ = doJSON(t, handler, http.MethodPost, "/api/push/unsubscribe", map[string]any{}, token)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("empty unsubscribe -> %d, want 400", rec.Code)
	}
}

// An endpoint is a secret, but unsubscribing is still account-scoped: another
// signed-in user must not be able to remove somebody else's device.
func TestPushUnsubscribeRejectsAnotherUsersDevice(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	customerToken := login(t, handler, "demo@example.com", "demo1234")
	adminToken := login(t, handler, "admin@fayfort.com", "admin123")

	doJSON(t, handler, http.MethodPost, "/api/push/subscribe", map[string]any{
		"endpoint": "https://push.example/customer-device",
		"keys":     map[string]string{"p256dh": strings.Repeat("A", 87), "auth": "AAAAAAAAAAAAAAAAAAAAAA"},
	}, customerToken)

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/push/unsubscribe", map[string]any{
		"endpoint": "https://push.example/customer-device",
	}, adminToken)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("cross-account unsubscribe -> %d, want 404", rec.Code)
	}
	subs, _ := db.PushSubscriptionsByRole("customer")
	if len(subs) != 1 {
		t.Fatalf("another account removed the device: %+v", subs)
	}
}

// The delivery test must only reach the caller's own devices, never another
// account that happens to share the same role.
func TestPushTestEndpointIgnoresOtherUsersDevices(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	adminToken := login(t, handler, "admin@fayfort.com", "admin123")

	recorder := newPushRecorder(t)
	recorder.subscribeDevice(t, db, recorder.server.URL+"/push/mine", "admin@fayfort.com", "admin")
	recorder.subscribeDevice(t, db, recorder.server.URL+"/push/theirs", "colleague@fayfort.com", "admin")

	rec, payload := doJSON(t, handler, http.MethodPost, "/api/push/test", nil, adminToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("test push -> %d: %s", rec.Code, rec.Body.String())
	}
	if payload["sent"] != float64(1) {
		t.Fatalf("payload = %v, want sent=1", payload)
	}
	if recorder.count() != 1 {
		t.Fatalf("deliveries = %d, want 1", recorder.count())
	}
	req, _ := recorder.last()
	if got := req.URL.Path; got != "/push/mine" {
		t.Fatalf("notified %q, want the caller's own device", got)
	}
}

// A customer device must never receive staff-only notifications.
func TestPushSubscriptionsAreIsolatedByRole(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	customerToken := login(t, handler, "demo@example.com", "demo1234")
	adminToken := login(t, handler, "admin@fayfort.com", "admin123")

	doJSON(t, handler, http.MethodPost, "/api/push/subscribe", map[string]any{
		"endpoint": "https://push.example/customer-device",
		"keys":     map[string]string{"p256dh": strings.Repeat("A", 87), "auth": "AAAAAAAAAAAAAAAAAAAAAA"},
	}, customerToken)
	doJSON(t, handler, http.MethodPost, "/api/push/subscribe", map[string]any{
		"endpoint": "https://push.example/admin-device",
		"keys":     map[string]string{"p256dh": strings.Repeat("A", 87), "auth": "AAAAAAAAAAAAAAAAAAAAAA"},
	}, adminToken)

	adminSubs, _ := db.PushSubscriptionsByRole("admin")
	customerSubs, _ := db.PushSubscriptionsByRole("customer")
	if len(adminSubs) != 1 || adminSubs[0].Endpoint != "https://push.example/admin-device" {
		t.Fatalf("admin subscriptions = %+v", adminSubs)
	}
	if len(customerSubs) != 1 || customerSubs[0].Endpoint != "https://push.example/customer-device" {
		t.Fatalf("customer subscriptions = %+v", customerSubs)
	}
	if customerSubs[0].UserRole != "customer" {
		t.Fatalf("customer device stored with role %q", customerSubs[0].UserRole)
	}
}

// A staff action that raises a notification must reach that role's devices.
func TestNotifyAdminDeliversPushToAdminDevices(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	customerToken := login(t, handler, "demo@example.com", "demo1234")

	recorder := newPushRecorder(t)
	// Only an admin device is registered, so any delivery proves the fan-out is
	// role-scoped.
	recorder.subscribe(t, db, "admin@fayfort.com", "admin")

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/sourcing-requests", map[string]any{
		"product":      "Solar inverter",
		"quantity":     40,
		"budget":       8000000,
		"currency":     "NGN",
		"contactPhone": "+234 800 000 0000",
	}, customerToken)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create request -> %d: %s", rec.Code, rec.Body.String())
	}

	recorder.waitFor(t, 1)
	request, body := recorder.last()
	if request == nil {
		t.Fatal("no push was delivered")
	}
	if got := request.Header.Get("Authorization"); !strings.HasPrefix(got, "vapid ") {
		t.Fatalf("Authorization = %q, want a vapid signature", got)
	}
	if len(body) == 0 {
		t.Fatal("push body is empty")
	}
}

// A staff action that notifies the customer must reach customer devices.
func TestNotifyCustomerDeliversPushToCustomerDevices(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	adminToken := login(t, handler, "admin@fayfort.com", "admin123")

	recorder := newPushRecorder(t)
	recorder.subscribe(t, db, "demo@example.com", "customer")

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/admin/requests/REQ-1009/quote", map[string]any{
		"supplier":  "Guangzhou Hanmor Lighting",
		"valueUsd":  24500,
		"marginBps": 3200,
	}, adminToken)
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("issue quote -> %d: %s", rec.Code, rec.Body.String())
	}

	recorder.waitFor(t, 1)
	request, _ := recorder.last()
	if request == nil {
		t.Fatal("no push was delivered to the customer device")
	}
	if got := request.Header.Get("Content-Encoding"); got != "aes128gcm" {
		t.Fatalf("Content-Encoding = %q, want aes128gcm", got)
	}
}

// A staff chat reply must reach customer devices even though the bell does not
// track chat: the unread badge is the only in-app signal.
func TestStaffChatReplyPushesToCustomer(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	adminToken := login(t, handler, "admin@fayfort.com", "admin123")

	recorder := newPushRecorder(t)
	recorder.subscribe(t, db, "demo@example.com", "customer")

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/admin/messages/TH-001/reply", map[string]any{
		"text": "We have secured a supplier for your handbags.",
	}, adminToken)
	if rec.Code != http.StatusCreated {
		t.Fatalf("reply -> %d: %s", rec.Code, rec.Body.String())
	}
	recorder.waitFor(t, 1)
	if recorder.count() != 1 {
		t.Fatalf("deliveries = %d, want 1", recorder.count())
	}
}

// A customer chat message must reach staff devices.
func TestCustomerChatMessagePushesToAdmin(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	customerToken := login(t, handler, "demo@example.com", "demo1234")

	recorder := newPushRecorder(t)
	recorder.subscribe(t, db, "admin@fayfort.com", "admin")

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/portal/thread", map[string]any{
		"subject": "Push test",
		"text":    "Can you confirm the deposit terms?",
	}, customerToken)
	if rec.Code != http.StatusCreated {
		t.Fatalf("post -> %d: %s", rec.Code, rec.Body.String())
	}
	recorder.waitFor(t, 1)
	if recorder.count() != 1 {
		t.Fatalf("deliveries = %d, want 1", recorder.count())
	}
}

func TestChatPreviewTrimsAndSummarises(t *testing.T) {
	if got := chatPreview("  hello   there  ", 0); got != "hello there" {
		t.Fatalf("preview = %q", got)
	}
	if got := chatPreview("", 2); got != "Sent 2 attachment(s)" {
		t.Fatalf("preview = %q", got)
	}
	if got := chatPreview("", 0); got != "Sent you a new message" {
		t.Fatalf("preview = %q", got)
	}
	long := strings.Repeat("a", 200)
	got := chatPreview(long, 0)
	if len([]rune(got)) != 141 {
		t.Fatalf("preview length = %d, want 141", len([]rune(got)))
	}
	if !strings.HasSuffix(got, "…") {
		t.Fatalf("preview = %q, want an ellipsis", got)
	}
	// Multi-byte characters must not be cut in half.
	accents := chatPreview(strings.Repeat("é", 200), 0)
	if !utf8.ValidString(accents) {
		t.Fatalf("preview %q is not valid UTF-8", accents)
	}
	if len([]rune(accents)) != 141 {
		t.Fatalf("preview length = %d, want 141", len([]rune(accents)))
	}
	if strings.Contains(accents, "\uFFFD") {
		t.Fatalf("preview %q contains a replacement character", accents)
	}
}

// A customer push must open the portal page that actually exists.
func TestCustomerPushTargetPointsAtThePortal(t *testing.T) {
	if got := customerPushTarget("REQ-1047"); got != "/dashboard/REQ-1047" {
		t.Fatalf("target = %q, want /dashboard/REQ-1047", got)
	}
	if got := customerPushTarget(""); got != "/notifications" {
		t.Fatalf("target = %q, want /notifications", got)
	}
}

func TestPushTestEndpointRequiresASubscription(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()
	token := login(t, handler, "demo@example.com", "demo1234")

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/push/test", nil, token)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("test push with no devices -> %d, want 400", rec.Code)
	}
}

func TestPushTestEndpointSendsToOwnDevices(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	adminToken := login(t, handler, "admin@fayfort.com", "admin123")

	recorder := newPushRecorder(t)
	recorder.subscribe(t, db, "admin@fayfort.com", "admin")

	rec, payload := doJSON(t, handler, http.MethodPost, "/api/push/test", nil, adminToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("test push -> %d: %s", rec.Code, rec.Body.String())
	}
	if payload["sent"] != float64(1) {
		t.Fatalf("payload = %v, want sent=1", payload)
	}
	if recorder.count() != 1 {
		t.Fatalf("deliveries = %d, want 1", recorder.count())
	}
}

func TestPushTestEndpointRequiresAuth(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/push/test", nil, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated -> %d, want 401", rec.Code)
	}
}
