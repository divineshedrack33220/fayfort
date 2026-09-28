package httpapi

import (
	"testing"
	"time"

	"fayfort/backend/internal/store"
)

// TestHubRingsInviteeViaNotifier covers the push path that makes unanswered
// rings audible outside an open chat tab: the hub asks the notifier to ring
// the invitee's devices when the invitee is not live on the thread, and
// reports the missed call once the invite expires.
func TestHubRingsInviteeViaNotifier(t *testing.T) {
	old := wsCallInviteTTL
	wsCallInviteTTL = 150 * time.Millisecond
	defer func() { wsCallInviteTTL = old }()

	admin := &wsClient{
		user: store.UserRow{Name: "Ada Okafor", Email: "admin@fayfort.com", Role: "admin"},
		send: make(chan wsMessage, 16),
	}
	customer := &wsClient{
		user: store.UserRow{Name: "Ama Mensah", Email: "ama@example.com", Role: "customer"},
		send: make(chan wsMessage, 16),
	}

	// A live invitee is covered by the in-app ring card, so the notifier must
	// not be asked to push a duplicate ring.
	live := newWSHub()
	live.setCallNotifier(func(e callEvent) {
		if e.kind == callEventInvite {
			t.Fatal("a live invitee must not be double-rung")
		}
	})
	live.mu.Lock()
	live.clients["TH-LIVE"] = map[*wsClient]struct{}{customer: {}}
	live.mu.Unlock()
	live.callInviteEvent("TH-LIVE", "call-2", "video", admin)

	// No customer is subscribed to the ring thread, so the ring must be pushed
	// and an unanswered invite must eventually be reported as missed.
	hub := newWSHub() // starts its own sweep goroutine
	var got []callEvent
	hub.setCallNotifier(func(e callEvent) { got = append(got, e) })
	hub.mu.Lock()
	hub.clients["TH-RING"] = map[*wsClient]struct{}{admin: {}}
	hub.mu.Unlock()

	hub.callInviteEvent("TH-RING", "call-1", "audio", admin)
	if len(got) != 1 {
		t.Fatalf("want a ring event, got %d", len(got))
	}
	ring := got[0]
	if ring.kind != callEventInvite || ring.threadID != "TH-RING" || ring.callID != "call-1" ||
		ring.from != "Ada Okafor" || ring.fromEmail != "admin@fayfort.com" ||
		ring.role != "staff" || ring.mode != "audio" {
		t.Fatalf("unexpected ring event: %+v", ring)
	}

	// Let the invite expire: the sweep reports it as missed.
	deadline := time.Now().Add(3 * time.Second)
	for len(got) < 2 && time.Now().Before(deadline) {
		time.Sleep(50 * time.Millisecond)
	}
	if len(got) != 2 {
		t.Fatalf("want an invite + missed event, got %d", len(got))
	}
	missed := got[1]
	if missed.kind != callEventMissed || missed.callID != "call-1" ||
		missed.fromEmail != "admin@fayfort.com" || missed.role != "staff" || missed.mode != "audio" {
		t.Fatalf("unexpected missed event: %+v", missed)
	}
}
