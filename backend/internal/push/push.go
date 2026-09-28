// Package push delivers Web Push notifications to browser subscriptions.
//
// Subscriptions are created by the client (see the Fayfort service worker) and
// stored per signed-in user, so a notification only reaches devices belonging to
// the audience that is allowed to see it. VAPID keys come from the environment
// in production; ephemeral keys are generated for local development so the whole
// flow works out of the box.
package push

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/SherClockHolmes/webpush-go"

	"fayfort/backend/internal/domain"
)

// Env vars for the VAPID keypair. Both must be set together in production so
// that subscriptions survive a restart.
const (
	EnvPublicKey  = "FAYFORT_VAPID_PUBLIC_KEY"
	EnvPrivateKey = "FAYFORT_VAPID_PRIVATE_KEY"
	EnvSubject    = "FAYFORT_VAPID_SUBJECT"
	EnvTimeout    = "FAYFORT_PUSH_TIMEOUT"
)

// DefaultSubject is the VAPID `sub` claim browsers require as a contact.
const DefaultSubject = "mailto:support@fayfort.com"

// Default icons advertised to the browser for OS-level notification chrome.
const (
	DefaultIcon  = "/icon-192.png"
	DefaultBadge = "/badge-96.png"
)

// ErrNoKeys is returned when the sender has no VAPID keypair configured.
var ErrNoKeys = errors.New("push: vapid keys not configured")

// Payload is the JSON body handed to the service worker's `push` handler.
type Payload struct {
	Title              string `json:"title"`
	Body               string `json:"body"`
	URL                string `json:"url"`
	Tag                string `json:"tag,omitempty"`
	ID                 string `json:"id,omitempty"`
	At                 string `json:"at,omitempty"`
	Icon               string `json:"icon,omitempty"`
	Badge              string `json:"badge,omitempty"`
	RequireInteraction bool   `json:"requireInteraction,omitempty"`
	// Vibrate is the OS-level ring pattern played when the notification is
	// shown. Calls set a longer, attention-grabbing pattern.
	Vibrate []int `json:"vibrate,omitempty"`
}

// Sender signs and delivers payloads to push services.
type Sender struct {
	publicKey  string
	privateKey string
	subject    string
	client     webpush.HTTPClient
	log        *log.Logger
}

// NewSender builds a sender from the environment, generating an ephemeral
// keypair when none is configured. The returned bool reports whether the
// keypair was generated rather than supplied.
func NewSender(l *log.Logger) (*Sender, bool) {
	publicKey := strings.TrimSpace(os.Getenv(EnvPublicKey))
	privateKey := strings.TrimSpace(os.Getenv(EnvPrivateKey))
	subject := strings.TrimSpace(os.Getenv(EnvSubject))
	if subject == "" {
		subject = DefaultSubject
	}

	generated := false
	if publicKey == "" || privateKey == "" {
		if (publicKey == "") != (privateKey == "") {
			l.Printf("push: %s and %s must be set together; generating an ephemeral keypair", EnvPublicKey, EnvPrivateKey)
		}
		var err error
		privateKey, publicKey, err = webpush.GenerateVAPIDKeys()
		if err != nil {
			l.Printf("push: could not generate VAPID keys: %v", err)
			return &Sender{subject: subject, client: newClient(), log: l}, false
		}
		generated = true
	}

	return &Sender{
		publicKey:  publicKey,
		privateKey: privateKey,
		subject:    subject,
		client:     newClient(),
		log:        l,
	}, generated
}

func newClient() webpush.HTTPClient {
	timeout := 10 * time.Second
	if raw := strings.TrimSpace(os.Getenv(EnvTimeout)); raw != "" {
		if parsed, err := time.ParseDuration(raw); err == nil && parsed > 0 {
			timeout = parsed
		}
	}
	return &http.Client{Timeout: timeout, Transport: ipv4Transport()}
}

// ipv4Transport pins delivery to IPv4. Push service hostnames also publish AAAA
// records, and a host without an IPv6 route fails the whole send with
// "network is unreachable" even though the IPv4 address works.
func ipv4Transport() *http.Transport {
	dialer := &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
		return dialer.DialContext(ctx, "tcp4", addr)
	}
	return transport
}

// PublicKey returns the VAPID public key browsers need to subscribe.
func (s *Sender) PublicKey() string { return s.publicKey }

// Ready reports whether the sender can deliver notifications.
func (s *Sender) Ready() bool { return s.publicKey != "" && s.privateKey != "" }

// marshalPayload applies the defaults every browser needs (icons, timestamp)
// and encodes the payload the service worker expects.
func marshalPayload(payload Payload) ([]byte, error) {
	if payload.Icon == "" {
		payload.Icon = DefaultIcon
	}
	if payload.Badge == "" {
		payload.Badge = DefaultBadge
	}
	if payload.At == "" {
		payload.At = time.Now().UTC().Format(time.RFC3339)
	}
	return json.Marshal(payload)
}

// Send delivers one payload to a single subscription and reports the push
// service's HTTP status. A 404 or 410 means the browser discarded the
// subscription, so callers should prune it.
func (s *Sender) Send(ctx context.Context, sub domain.PushSubscription, payload Payload) (int, error) {
	if !s.Ready() {
		return 0, ErrNoKeys
	}
	if sub.Endpoint == "" || sub.P256dh == "" || sub.Auth == "" {
		return 0, errors.New("push: incomplete subscription")
	}

	body, err := marshalPayload(payload)
	if err != nil {
		return 0, err
	}

	// The push service is a third party and a lost notification is a lost
	// notification, so a transport-level failure (DNS, dial, reset) is retried.
	// An HTTP status is returned as-is: 404/410 mean the subscription is gone
	// and must be pruned, not retried.
	var lastErr error
	for attempt := 1; attempt <= sendAttempts; attempt++ {
		if attempt > 1 {
			select {
			case <-ctx.Done():
				return 0, ctx.Err()
			case <-time.After(retryBackoff * time.Duration(attempt-1)):
			}
		}
		status, err := s.sendOnce(ctx, sub, body)
		if err == nil {
			return status, nil
		}
		if !retryable(err) {
			return 0, err
		}
		lastErr = err
	}
	return 0, lastErr
}

// sendAttempts and retryBackoff bound how long a flaky network can delay a
// single notification: three attempts with a growing pause.
const (
	sendAttempts = 3
	retryBackoff = 500 * time.Millisecond
)

// retryable reports whether a send failure is worth another attempt. A
// cancelled or expired caller context is not: the request is already gone.
func retryable(err error) bool {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}
	// net/http wraps transport failures in *url.Error, which is a net.Error.
	return errors.Is(err, syscall.ECONNRESET) || errors.Is(err, syscall.ECONNREFUSED)
}

func (s *Sender) sendOnce(ctx context.Context, sub domain.PushSubscription, body []byte) (int, error) {
	// The push service is a third party: never let a slow endpoint hold up the
	// action that produced the notification.
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	resp, err := webpush.SendNotificationWithContext(ctx, body, &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys:     webpush.Keys{Auth: sub.Auth, P256dh: sub.P256dh},
	}, &webpush.Options{
		HTTPClient:      s.client,
		Subscriber:      s.subject,
		TTL:             24 * 60 * 60,
		VAPIDPublicKey:  s.publicKey,
		VAPIDPrivateKey: s.privateKey,
	})
	if err != nil {
		return 0, err
	}
	if resp.Body != nil {
		_ = resp.Body.Close()
	}
	return resp.StatusCode, nil
}

// Expired reports whether a push service status means the subscription is gone.
func Expired(status int) bool { return status == http.StatusNotFound || status == http.StatusGone }
