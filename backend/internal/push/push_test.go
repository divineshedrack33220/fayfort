package push

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/SherClockHolmes/webpush-go"

	"fayfort/backend/internal/domain"
)

// fakeClient stands in for a push service so delivery can be asserted without
// touching the network.
type fakeClient struct {
	mu       sync.Mutex
	requests []*http.Request
	bodies   [][]byte
	calls    int
	status   int
	err      error
	// failFirst makes the client fail with err for the first N calls, so a test
	// can prove a transient network error is retried rather than dropped.
	failFirst int
}

// timeoutError is a net.Error, which is what a DNS or dial failure surfaces as.
type timeoutError struct{}

func (timeoutError) Error() string   { return "dial tcp: i/o timeout" }
func (timeoutError) Timeout() bool   { return true }
func (timeoutError) Temporary() bool { return true }

func (f *fakeClient) Do(req *http.Request) (*http.Response, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.failFirst > 0 && f.calls <= f.failFirst {
		if f.err != nil {
			return nil, f.err
		}
		return nil, timeoutError{}
	}
	if f.err != nil {
		return nil, f.err
	}
	body, _ := io.ReadAll(req.Body)
	f.requests = append(f.requests, req)
	f.bodies = append(f.bodies, body)
	status := f.status
	if status == 0 {
		status = http.StatusCreated
	}
	return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(""))}, nil
}

func newTestSender(t *testing.T, client webpush.HTTPClient) *Sender {
	t.Helper()
	return &Sender{
		publicKey:  "BPTestPublicKeyValue",
		privateKey: "test-private-key",
		subject:    DefaultSubject,
		client:     client,
		log:        log.New(io.Discard, "", 0),
	}
}

// testP256dh must be a real point on the P-256 curve: the library rejects
// anything else, exactly as a browser-generated key would be.
var testP256dh = func() string {
	_, publicKey, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		panic(err)
	}
	return publicKey
}()

// testAuth is a 16-byte auth secret, the size browsers send.
var testAuth = base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{7}, 16))

func testSubscription(endpoint string) domain.PushSubscription {
	return domain.PushSubscription{
		Endpoint:  endpoint,
		P256dh:    testP256dh,
		Auth:      testAuth,
		UserEmail: "demo@example.com",
		UserRole:  RoleCustomer,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
}

func TestSendSignsPayloadWithVAPID(t *testing.T) {
	client := &fakeClient{}
	sender := newTestSender(t, client)

	status, err := sender.Send(context.Background(),
		testSubscription("https://fcm.googleapis.com/fcm/send/abc123"),
		Payload{Title: "New quote", Body: "Quote ready", URL: "/admin/quotes"})
	if err != nil {
		t.Fatalf("send: %v", err)
	}
	if status != http.StatusCreated {
		t.Fatalf("status = %d, want 201", status)
	}
	if len(client.requests) != 1 {
		t.Fatalf("requests = %d, want 1", len(client.requests))
	}
	req := client.requests[0]
	if got := req.URL.String(); got != "https://fcm.googleapis.com/fcm/send/abc123" {
		t.Fatalf("url = %q", got)
	}
	if auth := req.Header.Get("Authorization"); !strings.HasPrefix(auth, "vapid ") {
		t.Fatalf("Authorization = %q, want a vapid signature", auth)
	}
	if ttl := req.Header.Get("TTL"); ttl == "" {
		t.Fatal("missing TTL header")
	}
	// The body is encrypted for the browser, so assert the encryption envelope
	// rather than the plaintext payload.
	if got := req.Header.Get("Content-Encoding"); got != "aes128gcm" {
		t.Fatalf("Content-Encoding = %q, want aes128gcm", got)
	}
	if len(client.bodies[0]) == 0 {
		t.Fatal("encrypted body is empty")
	}
}

func TestMarshalPayloadShape(t *testing.T) {
	raw, err := marshalPayload(Payload{Title: "New quote", Body: "Quote ready", URL: "/admin/quotes"})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var payload Payload
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("payload: %v", err)
	}
	if payload.Title != "New quote" || payload.Body != "Quote ready" {
		t.Fatalf("payload = %+v", payload)
	}
	if payload.URL != "/admin/quotes" {
		t.Fatalf("url = %q", payload.URL)
	}
	// Icons must always be set: an OS shows a blank entry without them.
	if payload.Icon != DefaultIcon || payload.Badge != DefaultBadge {
		t.Fatalf("icons = %q/%q", payload.Icon, payload.Badge)
	}
	if payload.At == "" {
		t.Fatal("payload is missing a timestamp")
	}
}

func TestMarshalPayloadKeepsExplicitFields(t *testing.T) {
	raw, err := marshalPayload(Payload{
		Title: "t",
		Icon:  "/custom.png",
		Badge: "/custom-badge.png",
		At:    "2026-01-01T00:00:00Z",
		Tag:   "custom",
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var payload Payload
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("payload: %v", err)
	}
	if payload.Icon != "/custom.png" || payload.Badge != "/custom-badge.png" {
		t.Fatalf("custom icons were overwritten: %+v", payload)
	}
	if payload.At != "2026-01-01T00:00:00Z" || payload.Tag != "custom" {
		t.Fatalf("payload = %+v", payload)
	}
}

func TestSendRejectsIncompleteSubscription(t *testing.T) {
	sender := newTestSender(t, &fakeClient{})
	if _, err := sender.Send(context.Background(),
		domain.PushSubscription{Endpoint: "https://push.example/1"},
		Payload{Title: "t"}); err == nil {
		t.Fatal("expected an error for a subscription with no keys")
	}
}

func TestSendWithoutKeys(t *testing.T) {
	sender := &Sender{log: log.New(io.Discard, "", 0)}
	if _, err := sender.Send(context.Background(), testSubscription("https://push.example/1"), Payload{}); err != ErrNoKeys {
		t.Fatalf("err = %v, want ErrNoKeys", err)
	}
	if sender.Ready() {
		t.Fatal("sender should not be ready without keys")
	}
}

func TestExpiredStatuses(t *testing.T) {
	for _, status := range []int{http.StatusNotFound, http.StatusGone} {
		if !Expired(status) {
			t.Fatalf("status %d should be treated as expired", status)
		}
	}
	for _, status := range []int{http.StatusCreated, http.StatusBadRequest, http.StatusInternalServerError} {
		if Expired(status) {
			t.Fatalf("status %d should not be treated as expired", status)
		}
	}
}

// memoryStore is an in-memory SubscriptionStore for dispatcher tests.
type memoryStore struct {
	mu   sync.Mutex
	subs map[string]domain.PushSubscription
}

func newMemoryStore(subs ...domain.PushSubscription) *memoryStore {
	m := &memoryStore{subs: map[string]domain.PushSubscription{}}
	for _, sub := range subs {
		m.subs[sub.Endpoint] = sub
	}
	return m
}

func (m *memoryStore) PushSubscriptionsByRole(role string) ([]domain.PushSubscription, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]domain.PushSubscription, 0)
	for _, sub := range m.subs {
		if sub.UserRole == role {
			out = append(out, sub)
		}
	}
	return out, nil
}

func (m *memoryStore) PushSubscriptionsByUser(email string) ([]domain.PushSubscription, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]domain.PushSubscription, 0)
	for _, sub := range m.subs {
		if sub.UserEmail == email {
			out = append(out, sub)
		}
	}
	return out, nil
}

func (m *memoryStore) DeletePushSubscription(endpoint string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.subs, endpoint)
	return nil
}

func (m *memoryStore) count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.subs)
}

func TestDispatchSyncFansOutByRole(t *testing.T) {
	store := newMemoryStore(
		testSubscription("https://push.example/admin-1"),
		testSubscription("https://push.example/customer-1"),
	)
	adminSub := testSubscription("https://push.example/admin-1")
	adminSub.UserEmail = "admin@fayfort.com"
	adminSub.UserRole = RoleAdmin
	store.subs[adminSub.Endpoint] = adminSub
	client := &fakeClient{}
	dispatcher := NewDispatcher(newTestSender(t, client), store, log.New(io.Discard, "", 0))

	result, err := dispatcher.DispatchSync(context.Background(), RoleAdmin,
		PayloadFor(RoleAdmin, "New quote", "Quote ready", "/admin/quotes"))
	if err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	if result.Subscriptions != 1 || result.Sent != 1 || result.Failed != 0 {
		t.Fatalf("result = %+v, want 1 subscription sent", result)
	}
	if len(client.requests) != 1 {
		t.Fatalf("requests = %d, want 1 (customer devices must not be contacted)", len(client.requests))
	}
	if got := client.requests[0].URL.String(); got != "https://push.example/admin-1" {
		t.Fatalf("url = %q", got)
	}
}

func TestDispatchSyncFansOutToManyDevicesConcurrently(t *testing.T) {
	// A single-device fan-out cannot observe a data race on the shared result
	// counters, so exercise the real case: one customer signed in on several
	// devices. Run under -race.
	store := newMemoryStore()
	for i := 0; i < 8; i++ {
		sub := testSubscription(fmt.Sprintf("https://push.example/customer-%d", i))
		sub.UserRole = RoleCustomer
		store.subs[sub.Endpoint] = sub
	}
	client := &fakeClient{}
	dispatcher := NewDispatcher(newTestSender(t, client), store, log.New(io.Discard, "", 0))

	result, err := dispatcher.DispatchSync(context.Background(), RoleCustomer,
		PayloadFor(RoleCustomer, "Quote ready", "Your quote is waiting", "/dashboard/REQ-1"))
	if err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	if result.Subscriptions != 8 || result.Sent != 8 || result.Failed != 0 {
		t.Fatalf("result = %+v, want 8 sent", result)
	}
}

// A dropped connection or DNS blip must not lose the notification: the sender
// retries a transport failure and reports the eventual outcome.
func TestSendRetriesTransientNetworkFailures(t *testing.T) {
	client := &fakeClient{failFirst: 2}
	sender := newTestSender(t, client)

	status, err := sender.Send(context.Background(), testSubscription("https://push.example/1"),
		PayloadFor(RoleCustomer, "Quote ready", "Body", "/dashboard/REQ-1"))
	if err != nil {
		t.Fatalf("send: %v", err)
	}
	if status != http.StatusCreated {
		t.Fatalf("status = %d, want 201", status)
	}
	if client.calls != 3 {
		t.Fatalf("attempts = %d, want 3 (two failures then a success)", client.calls)
	}
}

// A failure that will not fix itself is not retried forever.
func TestSendStopsAfterTheAttemptBudget(t *testing.T) {
	client := &fakeClient{err: timeoutError{}}
	sender := newTestSender(t, client)

	if _, err := sender.Send(context.Background(), testSubscription("https://push.example/1"),
		Payload{Title: "t"}); err == nil {
		t.Fatal("expected an error when every attempt fails")
	}
	if client.calls != sendAttempts {
		t.Fatalf("attempts = %d, want %d", client.calls, sendAttempts)
	}
}

// A cancelled caller is not retried: the request is already gone.
func TestSendDoesNotRetryACancelledContext(t *testing.T) {
	client := &fakeClient{err: context.Canceled}
	sender := newTestSender(t, client)

	if _, err := sender.Send(context.Background(), testSubscription("https://push.example/1"),
		Payload{Title: "t"}); err == nil {
		t.Fatal("expected an error")
	}
	if client.calls != 1 {
		t.Fatalf("attempts = %d, want 1 for a non-retryable failure", client.calls)
	}
}

func TestDispatchUserSyncOnlyReachesTheCallersDevices(t *testing.T) {
	store := newMemoryStore()
	mine := testSubscription("https://push.example/mine")
	mine.UserEmail = "demo@example.com"
	mine.UserRole = RoleCustomer
	theirs := testSubscription("https://push.example/theirs")
	theirs.UserEmail = "someone.else@example.com"
	theirs.UserRole = RoleCustomer
	store.subs[mine.Endpoint] = mine
	store.subs[theirs.Endpoint] = theirs

	client := &fakeClient{}
	dispatcher := NewDispatcher(newTestSender(t, client), store, log.New(io.Discard, "", 0))

	result, err := dispatcher.DispatchUserSync(context.Background(), "demo@example.com",
		PayloadFor(RoleCustomer, "Test", "Working", "/dashboard"))
	if err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	if result.Subscriptions != 1 || result.Sent != 1 {
		t.Fatalf("result = %+v, want only the caller's device", result)
	}
	if len(client.requests) != 1 {
		t.Fatalf("requests = %d, want 1", len(client.requests))
	}
	if got := client.requests[0].URL.String(); got != mine.Endpoint {
		t.Fatalf("notified %q, want %q", got, mine.Endpoint)
	}
}

func TestDispatchSyncPrunesExpiredSubscriptions(t *testing.T) {
	store := newMemoryStore(testSubscription("https://push.example/gone"))
	client := &fakeClient{status: http.StatusGone}
	dispatcher := NewDispatcher(newTestSender(t, client), store, log.New(io.Discard, "", 0))

	result, err := dispatcher.DispatchSync(context.Background(), RoleCustomer, Payload{Title: "t"})
	if err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	if result.Pruned != 1 {
		t.Fatalf("pruned = %d, want 1", result.Pruned)
	}
	if store.count() != 0 {
		t.Fatal("expired subscription was not removed")
	}
}

func TestDispatchSyncCountsFailures(t *testing.T) {
	store := newMemoryStore(testSubscription("https://push.example/bad"))
	client := &fakeClient{status: http.StatusInternalServerError}
	dispatcher := NewDispatcher(newTestSender(t, client), store, log.New(io.Discard, "", 0))

	result, err := dispatcher.DispatchSync(context.Background(), RoleCustomer, Payload{Title: "t"})
	if err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	if result.Failed != 1 || result.Sent != 0 {
		t.Fatalf("result = %+v, want 1 failure", result)
	}
	if store.count() != 1 {
		t.Fatal("a failing endpoint must not be pruned")
	}
}

func TestDispatchIsSkippedWithoutKeys(t *testing.T) {
	store := newMemoryStore(testSubscription("https://push.example/1"))
	client := &fakeClient{}
	dispatcher := NewDispatcher(&Sender{log: log.New(io.Discard, "", 0)}, store, log.New(io.Discard, "", 0))

	dispatcher.Dispatch(RoleCustomer, Payload{Title: "t"})
	dispatcher.Wait()

	if len(client.requests) != 0 {
		t.Fatal("dispatched without a keypair")
	}
	if _, err := dispatcher.DispatchSync(context.Background(), RoleCustomer, Payload{}); err != ErrNoKeys {
		t.Fatalf("err = %v, want ErrNoKeys", err)
	}
}

func TestNewSenderGeneratesKeysWhenUnset(t *testing.T) {
	t.Setenv(EnvPublicKey, "")
	t.Setenv(EnvPrivateKey, "")

	sender, generated := NewSender(log.New(io.Discard, "", 0))
	if !generated {
		t.Fatal("expected an ephemeral keypair to be generated")
	}
	if !sender.Ready() {
		t.Fatal("sender should be ready after generation")
	}
	if sender.PublicKey() == "" {
		t.Fatal("public key is empty")
	}
	if sender.subject != DefaultSubject {
		t.Fatalf("subject = %q", sender.subject)
	}
}

func TestNewSenderPrefersEnvironmentKeys(t *testing.T) {
	t.Setenv(EnvPublicKey, "public-from-env")
	t.Setenv(EnvPrivateKey, "private-from-env")
	t.Setenv(EnvSubject, "mailto:ops@fayfort.com")

	sender, generated := NewSender(log.New(io.Discard, "", 0))
	if generated {
		t.Fatal("should not generate keys when the environment supplies them")
	}
	if sender.PublicKey() != "public-from-env" {
		t.Fatalf("public key = %q", sender.PublicKey())
	}
	if sender.subject != "mailto:ops@fayfort.com" {
		t.Fatalf("subject = %q", sender.subject)
	}
}

func TestPayloadForTargetsTheRightSurface(t *testing.T) {
	payload := PayloadFor(RoleCustomer, "Quote ready", "Your quote is in", "/requests/REQ-1")
	if payload.URL != "/requests/REQ-1" {
		t.Fatalf("url = %q", payload.URL)
	}
	if payload.Tag != "fayfort-customer" {
		t.Fatalf("tag = %q", payload.Tag)
	}
	if !payload.RequireInteraction {
		t.Fatal("real notifications should stay until dismissed")
	}
}

func TestMaskEndpointHidesSecrets(t *testing.T) {
	long := "https://fcm.googleapis.com/fcm/send/very-secret-token-value"
	got := maskEndpoint(long)
	if strings.Contains(got, "very-secret-token-value") {
		t.Fatalf("endpoint leaked in log: %q", got)
	}
	if !strings.HasPrefix(got, "https://") {
		t.Fatalf("masked endpoint = %q", got)
	}
	if maskEndpoint("short") != "short" {
		t.Fatal("short endpoints should be left alone")
	}
}
