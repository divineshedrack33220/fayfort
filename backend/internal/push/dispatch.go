package push

import (
	"context"
	"log"
	"sync"
	"time"

	"fayfort/backend/internal/domain"
)

// Roles that can receive push notifications. These mirror the `users.role`
// column so a device is only ever contacted for its own audience.
const (
	RoleAdmin    = "admin"
	RoleCustomer = "customer"
)

// SubscriptionStore is the persistence the dispatcher needs. Keeping it an
// interface lets the push package stay independent of the SQLite layer.
type SubscriptionStore interface {
	PushSubscriptionsByRole(role string) ([]domain.PushSubscription, error)
	PushSubscriptionsByUser(email string) ([]domain.PushSubscription, error)
	DeletePushSubscription(endpoint string) error
}

// Result summarises a fan-out so callers (and tests) can assert on it.
type Result struct {
	Subscriptions int `json:"subscriptions"`
	Sent          int `json:"sent"`
	Failed        int `json:"failed"`
	Pruned        int `json:"pruned"`
}

// Dispatcher fans notifications out to every device registered for a role.
type Dispatcher struct {
	sender *Sender
	store  SubscriptionStore
	log    *log.Logger
	wg     sync.WaitGroup
}

// NewDispatcher wires a sender to the subscription store.
func NewDispatcher(sender *Sender, store SubscriptionStore, l *log.Logger) *Dispatcher {
	return &Dispatcher{sender: sender, store: store, log: l}
}

// PublicKey exposes the VAPID public key for subscription requests.
func (d *Dispatcher) PublicKey() string { return d.sender.PublicKey() }

// Ready reports whether push delivery is configured.
func (d *Dispatcher) Ready() bool { return d.sender.Ready() }

// Dispatch delivers a payload to a role's devices in the background so the
// action that produced the notification never waits on a push service.
func (d *Dispatcher) Dispatch(role string, payload Payload) {
	if !d.sender.Ready() {
		return
	}
	d.wg.Add(1)
	go func() {
		defer d.wg.Done()
		if _, err := d.DispatchSync(context.Background(), role, payload); err != nil {
			d.log.Printf("push: dispatch to %s failed: %v", role, err)
		}
	}()
}

// DispatchSync delivers a payload and waits for the push services to respond.
// Subscriptions the push service reports as gone are pruned.
func (d *Dispatcher) DispatchSync(ctx context.Context, role string, payload Payload) (Result, error) {
	var result Result
	if !d.sender.Ready() {
		return result, ErrNoKeys
	}
	subs, err := d.store.PushSubscriptionsByRole(role)
	if err != nil {
		return result, err
	}
	return d.deliver(ctx, subs, payload), nil
}

// DispatchUserSync delivers a payload to one account's devices only. Used by
// the delivery test so a user never triggers a notification on somebody else's
// phone just because they share a role.
func (d *Dispatcher) DispatchUserSync(ctx context.Context, email string, payload Payload) (Result, error) {
	var result Result
	if !d.sender.Ready() {
		return result, ErrNoKeys
	}
	subs, err := d.store.PushSubscriptionsByUser(email)
	if err != nil {
		return result, err
	}
	return d.deliver(ctx, subs, payload), nil
}

// DispatchUser delivers a payload to one account's devices in the background.
// Used where a notification must reach a specific person (a missed call's
// caller) rather than everyone who shares their role.
func (d *Dispatcher) DispatchUser(email string, payload Payload) {
	if !d.sender.Ready() {
		return
	}
	d.wg.Add(1)
	go func() {
		defer d.wg.Done()
		if _, err := d.DispatchUserSync(context.Background(), email, payload); err != nil {
			d.log.Printf("push: dispatch to %s failed: %v", email, err)
		}
	}()
}

// deliver fans a payload out to a fixed set of devices, one goroutine each, and
// folds the per-device outcomes into a single Result once they have all landed.
func (d *Dispatcher) deliver(ctx context.Context, subs []domain.PushSubscription, payload Payload) Result {
	var result Result
	result.Subscriptions = len(subs)

	type outcome struct {
		status int
		err    error
	}
	results := make([]outcome, len(subs))

	var wg sync.WaitGroup
	for i, sub := range subs {
		wg.Add(1)
		go func(i int, sub domain.PushSubscription) {
			defer wg.Done()
			status, err := d.sender.Send(ctx, sub, payload)
			results[i] = outcome{status: status, err: err}
		}(i, sub)
	}
	wg.Wait()

	for i, sub := range subs {
		switch res := results[i]; {
		case res.err != nil:
			result.Failed++
			d.log.Printf("push: send to %s failed: %v", maskEndpoint(sub.Endpoint), res.err)
		case Expired(res.status):
			result.Pruned++
			if err := d.store.DeletePushSubscription(sub.Endpoint); err != nil {
				d.log.Printf("push: prune %s failed: %v", maskEndpoint(sub.Endpoint), err)
			}
		case res.status >= 200 && res.status < 300:
			result.Sent++
		default:
			result.Failed++
			d.log.Printf("push: %s returned status %d", maskEndpoint(sub.Endpoint), res.status)
		}
	}
	return result
}

// Wait blocks until in-flight background dispatches finish. Used by tests.
func (d *Dispatcher) Wait() { d.wg.Wait() }

// maskEndpoint keeps push service URLs (which are effectively secrets) out of
// logs while still making failures traceable.
func maskEndpoint(endpoint string) string {
	if len(endpoint) <= 24 {
		return endpoint
	}
	return endpoint[:24] + "…" + endpoint[len(endpoint)-8:]
}

// PayloadFor builds a notification payload for an audience.
func PayloadFor(role, title, body, url string) Payload {
	tag := "fayfort-" + role
	return Payload{
		Title:              title,
		Body:               body,
		URL:                url,
		Tag:                tag,
		At:                 time.Now().UTC().Format(time.RFC3339),
		Icon:               DefaultIcon,
		Badge:              DefaultBadge,
		RequireInteraction: true,
	}
}
