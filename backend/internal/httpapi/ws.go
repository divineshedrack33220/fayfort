package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"fayfort/backend/internal/store"
)

// wsTokenTTL bounds how long an unclaimed socket token stays usable.
const wsTokenTTL = 2 * time.Minute

// wsTypingTimeout is how long a typing indicator stays lit after the last
// typing event before the hub broadcasts "stopped". Kept as a var so tests
// can shorten the sweep.
var wsTypingTimeout = 4 * time.Second

// wsCallInviteTTL bounds how long an unanswered call invite keeps ringing.
// The caller also runs its own timer, but a backgrounded tab throttles
// timers, so the hub closes the ring for both sides once the window passes.
var wsCallInviteTTL = 45 * time.Second

// wsCallIDMaxLen bounds the caller-chosen id that correlates the invite with
// its accept/decline/end frames. It is relayed verbatim to the other side, so
// it is length-capped rather than trusted.
const wsCallIDMaxLen = 64

// wsMessage is the JSON envelope exchanged over a chat socket. The same shape
// is used in both directions; only the fields that apply to a message type are
// populated. From and Role are always set by the hub from the authenticated
// user, never taken from the client.
type wsMessage struct {
	Type     string `json:"type"`
	ThreadID string `json:"threadId,omitempty"`
	From     string `json:"from,omitempty"`
	Role     string `json:"role,omitempty"`
	CallID   string `json:"callId,omitempty"`
	Mode     string `json:"mode,omitempty"`
	Reason   string `json:"reason,omitempty"`
	Error    string `json:"error,omitempty"`
}

// wsClient is one authenticated WebSocket connection subscribed to threads.
// All writes happen on the single writeLoop goroutine via the send channel,
// so WriteJSON never races.
type wsClient struct {
	conn *websocket.Conn
	user store.UserRow
	send chan wsMessage
}

type typingState struct {
	from  string
	role  string
	until time.Time
}

// callInvite is the transient record of a ringing call. Like typing state it
// is memory-only: a missed invite simply expires, and either side can ring
// again. The hub stores it so a late subscriber still gets the ring and so a
// disconnecting caller does not leave a phone ringing forever.
type callInvite struct {
	callID    string
	from      string
	fromEmail string
	role      string
	mode      string
	until     time.Time
}

// callEventKind distinguishes the two call lifecycle facts the hub hands to
// the notifier: an unanswered ring (invite) and one that nobody answered
// (missed).
type callEventKind int

const (
	callEventInvite callEventKind = iota
	callEventMissed
)

// callEvent is a hub-level call lifecycle fact the notifier turns into device
// pushes and in-app entries. Everything is transient: the hub forgets a call
// the moment it ends or expires.
type callEvent struct {
	kind      callEventKind
	threadID  string
	callID    string
	from      string
	fromEmail string
	role      string
	mode      string
}

// wsHub routes typing events between the participants of a thread. It is
// deliberately transient: nothing is persisted, and a message that a client
// missed is simply skipped (typing indicators are re-triggered by the next
// keystroke).
type wsHub struct {
	mu      sync.Mutex
	clients map[string]map[*wsClient]struct{}
	admins  map[*wsClient]struct{}
	typing  map[string]map[string]typingState
	calls   map[string]map[*wsClient]callInvite
	// onCall routes call lifecycle events (invite, missed) to the notifier so
	// devices ring even when no socket is listening. Advisory: it is fired for
	// its side effects and the hub never blocks on it.
	onCall func(callEvent)
}

func newWSHub() *wsHub {
	h := &wsHub{
		clients: make(map[string]map[*wsClient]struct{}),
		admins:  make(map[*wsClient]struct{}),
		typing:  make(map[string]map[string]typingState),
		calls:   make(map[string]map[*wsClient]callInvite),
	}
	go h.sweep()
	return h
}

// setCallNotifier wires the callback that turns call lifecycle events into
// push notifications and in-app entries. Nil means the hub never notifies.
func (h *wsHub) setCallNotifier(fn func(callEvent)) {
	h.onCall = fn
}

func (h *wsHub) subscribe(c *wsClient, threadID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[threadID] == nil {
		h.clients[threadID] = make(map[*wsClient]struct{})
	}
	h.clients[threadID][c] = struct{}{}
	// Replay any in-flight indicator from the other side so a late subscriber
	// still sees "typing" and gets the matching "stopped" (otherwise a fresh
	// subscriber could see a bare stopped event when a keystroke raced their
	// subscribe frame).
	now := time.Now()
	for _, state := range h.typing[threadID] {
		if wsRole(c.user) == state.role || now.After(state.until) {
			continue
		}
		select {
		case c.send <- wsMessage{Type: "typing", ThreadID: threadID, From: state.from, Role: state.role}:
		default:
		}
	}
	// Same replay for a ringing call: the invitee may have loaded the thread
	// after the caller pressed call.
	// Keyed by the connection that rang, not by user: closing one of a user's
	// tabs must not cancel a call placed from another.
	for inviter, invite := range h.calls[threadID] {
		if inviter == c || now.After(invite.until) {
			continue
		}
		select {
		case c.send <- wsMessage{
			Type: "call:invite", ThreadID: threadID, CallID: invite.callID,
			From: invite.from, Role: invite.role, Mode: invite.mode,
		}:
		default:
		}
	}
}

func (h *wsHub) unsubscribe(c *wsClient, threadID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if set := h.clients[threadID]; set != nil {
		delete(set, c)
		if len(set) == 0 {
			delete(h.clients, threadID)
			delete(h.typing, threadID)
		}
	}
}

// unsubscribeAll drops the client from every thread (used when the socket
// dies so nobody keeps trying to reach it).
func (h *wsHub) unsubscribeAll(c *wsClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for threadID, set := range h.clients {
		if _, ok := set[c]; !ok {
			continue
		}
		delete(set, c)
		if len(set) == 0 {
			delete(h.clients, threadID)
			delete(h.typing, threadID)
		}
	}
	// A caller whose socket dies should not leave the other side ringing.
	h.cancelInvitesLocked(c)
}

// wsRole maps a stored user role to the chat-visible side of a conversation.
func wsRole(user store.UserRow) string {
	if user.Role == "admin" {
		return "staff"
	}
	return "customer"
}

// typingEvent records the indicator for the sender and relays it to the other
// side of the thread (a customer's keystrokes reach staff and vice versa).
func (h *wsHub) typingEvent(threadID string, c *wsClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[threadID] == nil {
		return
	}
	role := wsRole(c.user)
	if h.typing[threadID] == nil {
		h.typing[threadID] = make(map[string]typingState)
	}
	h.typing[threadID][c.user.Email] = typingState{
		from:  c.user.Name,
		role:  role,
		until: time.Now().Add(wsTypingTimeout),
	}
	h.broadcastLocked(threadID, wsMessage{
		Type: "typing", ThreadID: threadID, From: c.user.Name, Role: role,
	}, c)
}

// broadcast sends a message to every subscriber of a thread except the caller.
func (h *wsHub) broadcast(threadID string, msg wsMessage, except *wsClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.broadcastLocked(threadID, msg, except)
}

// validCallMode keeps unknown media modes off the wire. Media itself is
// negotiated by LiveKit; this only decides which buttons the peer offers.
func validCallMode(mode string) bool {
	return mode == "audio" || mode == "video"
}

// callInviteEvent records a ringing call and relays it to the other side of
// the thread. One ring per side at a time: a second invite from the same
// person supersedes the first so a double-click cannot leave two rings.
func (h *wsHub) callInviteEvent(threadID, callID, mode string, c *wsClient) {
	h.mu.Lock()
	if h.clients[threadID] == nil {
		h.mu.Unlock()
		return
	}
	role := wsRole(c.user)
	if h.calls[threadID] == nil {
		h.calls[threadID] = make(map[*wsClient]callInvite)
	}
	if previous, ok := h.calls[threadID][c]; ok && previous.callID != callID {
		h.sendCallCancelLocked(threadID, previous, "superseded")
	}
	invite := callInvite{
		callID:    callID,
		from:      c.user.Name,
		fromEmail: c.user.Email,
		role:      role,
		mode:      mode,
		until:     time.Now().Add(wsCallInviteTTL),
	}
	h.calls[threadID][c] = invite
	h.broadcastLocked(threadID, wsMessage{
		Type: "call:invite", ThreadID: threadID, CallID: callID,
		From: c.user.Name, Role: role, Mode: mode,
	}, c)
	// Push the ring when the invitee is not live on the thread: an open tab
	// gets the in-app ring card, but a backgrounded or closed browser needs
	// the OS notification to actually ring. Checked before releasing the lock
	// so nobody races the ring list.
	needRingPush := !h.hasLiveSideLocked(threadID, oppositeSide(role))
	h.mu.Unlock()
	if needRingPush && h.onCall != nil {
		h.onCall(callEvent{
			kind: callEventInvite, threadID: threadID, callID: callID,
			from: invite.from, fromEmail: invite.fromEmail, role: role, mode: mode,
		})
	}
}

// hasLiveSideLocked reports whether anyone of the given conversation side is
// currently subscribed to the thread.
func (h *wsHub) hasLiveSideLocked(threadID, side string) bool {
	for c := range h.clients[threadID] {
		if wsRole(c.user) == side {
			return true
		}
	}
	return false
}

// oppositeSide is the other half of a conversation.
func oppositeSide(side string) string {
	if side == "staff" {
		return "customer"
	}
	return "staff"
}

// callCloseEvent clears the ring this callId belongs to and relays the
// outcome. It backs accept, decline, cancel and end: from the hub's point of
// view they differ only in the frame the other side receives. The ring is
// matched by call id rather than by sender because the accept that resolves a
// call comes from the *other* participant.
func (h *wsHub) callCloseEvent(threadID, callID, frame, reason string, c *wsClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if byClient := h.calls[threadID]; byClient != nil {
		for client, invite := range byClient {
			if invite.callID == callID {
				delete(byClient, client)
			}
		}
		if len(byClient) == 0 {
			delete(h.calls, threadID)
		}
	}
	msg := wsMessage{Type: frame, ThreadID: threadID, CallID: callID, From: c.user.Name, Role: wsRole(c.user)}
	if reason != "" {
		msg.Reason = reason
	}
	h.broadcastLocked(threadID, msg, c)
}

// cancelInvitesLocked stops every call the departing connection had ringing.
func (h *wsHub) cancelInvitesLocked(c *wsClient) {
	for threadID, byClient := range h.calls {
		invite, ok := byClient[c]
		if !ok {
			continue
		}
		delete(byClient, c)
		if len(byClient) == 0 {
			delete(h.calls, threadID)
		}
		h.sendCallCancelLocked(threadID, invite, "left")
	}
}

// sendCallCancelLocked closes a ring for the side that did not place it.
func (h *wsHub) sendCallCancelLocked(threadID string, invite callInvite, reason string) {
	msg := wsMessage{
		Type: "call:cancel", ThreadID: threadID, CallID: invite.callID,
		From: invite.from, Role: invite.role, Reason: reason,
	}
	for c := range h.clients[threadID] {
		if wsRole(c.user) == invite.role {
			continue
		}
		select {
		case c.send <- msg:
		default:
		}
	}
}

// notifyMessage tells every subscriber of a thread that a new message has
// landed so they can refetch. The sender's own HTTP response already returns
// the updated thread, so there is no payload — just the wake-up signal.
func (h *wsHub) notifyMessage(threadID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	msg := wsMessage{Type: "message", ThreadID: threadID}
	for c := range h.clients[threadID] {
		select {
		case c.send <- msg:
		default:
		}
	}
}

func (h *wsHub) broadcastLocked(threadID string, msg wsMessage, except *wsClient) {
	for c := range h.clients[threadID] {
		if c == except {
			continue
		}
		select {
		case c.send <- msg:
		default:
		}
	}
}

// notifyThreads pokes every connected staff client so the admin refetches the
// thread list even when the activity happened on a thread it was not
// subscribed to (for example a brand-new conversation whose id is unknown to
// the admin yet).
func (h *wsHub) notifyThreads() {
	h.mu.Lock()
	defer h.mu.Unlock()
	msg := wsMessage{Type: "threads"}
	for c := range h.admins {
		select {
		case c.send <- msg:
		default:
		}
	}
}

// sweep fires "stopped" events once a sender's indicator expires and closes
// call rings nobody answered.
func (h *wsHub) sweep() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for now := range ticker.C {
		h.mu.Lock()
		for threadID, byEmail := range h.typing {
			for email, state := range byEmail {
				if !now.After(state.until) {
					continue
				}
				delete(byEmail, email)
				if len(byEmail) == 0 {
					delete(h.typing, threadID)
				}
				msg := wsMessage{Type: "stopped", ThreadID: threadID}
				for c := range h.clients[threadID] {
					if wsRole(c.user) == state.role {
						continue
					}
					select {
					case c.send <- msg:
					default:
					}
				}
			}
		}
		// Expire rings nobody answered. A client that never hears the cancel
		// keeps its own phone buzzing until its own timer fires, so the hub
		// pushes the close rather than only dropping its bookkeeping.
		var missed []callEvent
		for threadID, byClient := range h.calls {
			for client, invite := range byClient {
				if !now.After(invite.until) {
					continue
				}
				delete(byClient, client)
				h.sendCallCancelLocked(threadID, invite, "timeout")
				if invite.fromEmail != "" {
					missed = append(missed, callEvent{
						kind: callEventMissed, threadID: threadID, callID: invite.callID,
						from: invite.from, fromEmail: invite.fromEmail, role: invite.role, mode: invite.mode,
					})
				}
			}
			if len(byClient) == 0 {
				delete(h.calls, threadID)
			}
		}
		h.mu.Unlock()
		if h.onCall != nil {
			for _, event := range missed {
				h.onCall(event)
			}
		}
	}
}

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Local dev only: the frontend runs on another port, so the origin will
	// never match the backend host. Restrict to loopback hosts instead of
	// accepting anything.
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		u, err := url.Parse(origin)
		if err != nil {
			return false
		}
		host := u.Hostname()
		return host == "localhost" || host == "127.0.0.1" ||
			host == "0.0.0.0" || host == "::1" || strings.HasSuffix(host, ".localhost")
	},
}

// wsTokenEntry is a short-lived, single-use credential minted for browser
// sockets so they don't depend on the session cookie matching the socket's
// host. The chat page may be served from localhost while the backend (and
// socket) live on 127.0.0.1 — a host-only cookie never crosses that gap.
type wsTokenEntry struct {
	email   string
	expires time.Time
}

// handleWSToken issues a single-use token tied to the signed-in user.
func (s *Server) handleWSToken(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		writeError(w, http.StatusInternalServerError, "could not mint socket token")
		return
	}
	token := hex.EncodeToString(raw)
	s.wsMu.Lock()
	if s.wsTokens == nil {
		s.wsTokens = make(map[string]wsTokenEntry)
	}
	s.wsTokens[token] = wsTokenEntry{email: user.Email, expires: time.Now().Add(wsTokenTTL)}
	s.wsMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "token": token})
}

// wsUser resolves the authenticated user for a socket: a one-time `token`
// query parameter first, then the normal cookie/bearer session.
func (s *Server) wsUser(r *http.Request) (store.UserRow, bool, error) {
	if token := r.URL.Query().Get("token"); token != "" {
		s.wsMu.Lock()
		entry, ok := s.wsTokens[token]
		if ok {
			delete(s.wsTokens, token) // single-use
		}
		s.wsMu.Unlock()
		if !ok || time.Now().After(entry.expires) {
			return store.UserRow{}, false, nil
		}
		user, err := s.Store.UserByEmail(entry.email)
		if err != nil {
			return store.UserRow{}, false, err
		}
		return user, true, nil
	}
	return s.userFromRequest(r)
}

// handleWS upgrades the connection and owns its read loop. Auth happens here
// (instead of the requireAuth middleware) because the browser authenticates
// with a one-time token in the query string, not a header.
func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	user, ok, err := s.wsUser(r)
	if err != nil || !ok {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return // Upgrade already wrote the error response
	}
	c := &wsClient{conn: conn, user: user, send: make(chan wsMessage, 16)}
	s.hub.track(c)
	go c.writeLoop()
	s.readLoop(c)
}

// track registers a connected client so role-wide pokes (notifyThreads) can
// reach it even before it subscribes to any thread.
func (h *wsHub) track(c *wsClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if wsRole(c.user) == "staff" {
		h.admins[c] = struct{}{}
	}
}

// untrack forgets a client that is going away.
func (h *wsHub) untrack(c *wsClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.admins, c)
}

func (c *wsClient) writeLoop() {
	for msg := range c.send {
		c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if err := c.conn.WriteJSON(msg); err != nil {
			break
		}
	}
}

func (s *Server) readLoop(c *wsClient) {
	defer func() {
		s.hub.unsubscribeAll(c)
		s.hub.untrack(c)
		_ = c.conn.Close()
		close(c.send)
	}()
	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var msg wsMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}
		switch msg.Type {
		case "subscribe":
			if msg.ThreadID == "" {
				continue
			}
			s.hub.subscribe(c, msg.ThreadID)
		case "unsubscribe":
			if msg.ThreadID == "" {
				continue
			}
			s.hub.unsubscribe(c, msg.ThreadID)
		case "typing":
			if msg.ThreadID == "" {
				continue
			}
			s.hub.typingEvent(msg.ThreadID, c)
		case "call:invite":
			// A call needs a thread (it is authorised per conversation), an id
			// to correlate the outcome with, and a known media mode.
			if msg.ThreadID == "" || msg.CallID == "" || len(msg.CallID) > wsCallIDMaxLen {
				continue
			}
			if !validCallMode(msg.Mode) {
				continue
			}
			s.hub.callInviteEvent(msg.ThreadID, msg.CallID, msg.Mode, c)
		case "call:accept", "call:decline", "call:cancel", "call:end":
			if msg.ThreadID == "" || msg.CallID == "" || len(msg.CallID) > wsCallIDMaxLen {
				continue
			}
			s.hub.callCloseEvent(msg.ThreadID, msg.CallID, msg.Type, msg.Reason, c)
		case "ping":
			select {
			case c.send <- wsMessage{Type: "pong"}:
			default:
			}
		}
	}
}
