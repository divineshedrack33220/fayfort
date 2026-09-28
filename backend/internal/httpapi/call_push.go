package httpapi

import (
	"strconv"
	"time"

	"fayfort/backend/internal/domain"
	"fayfort/backend/internal/push"
)

// notifyCallEvent turns hub call lifecycle events into device pushes and
// in-app entries. Everything here is best-effort: the source action never
// waits on a push service, and a lost notification is acceptable on this
// platform — but the in-app lists are always recorded so the bell works even
// with browser notifications off.
func (s *Server) notifyCallEvent(e callEvent) {
	switch e.kind {
	case callEventInvite:
		s.pushRingToInvitee(e)
	case callEventMissed:
		s.notifyMissedCall(e)
	}
}

// pushRingToInvitee rings the invitee's devices. The hub only fires this when
// the invitee is not already live on the thread, so a ringing OS notification
// never duplicates the in-app ring card.
func (s *Server) pushRingToInvitee(e callEvent) {
	side := oppositeSide(e.role)
	s.pushCallToRole(
		pushRoleFor(side),
		"Incoming call from "+e.from,
		callModePhrase(e.mode)+" — open the conversation to pick up.",
		routeFor(side, e.threadID),
		"fayfort-call-"+e.callID,
	)
}

// notifyMissedCall tells both sides an unanswered ring expired: the invitee
// that the call was missed, and the caller that nobody answered. The invitee
// alert lands as an in-app entry too so the bell survives the browser being
// closed.
func (s *Server) notifyMissedCall(e callEvent) {
	side := oppositeSide(e.role)
	body := "You missed " + callModePhrase(e.mode) + " call."
	switch side {
	case "staff":
		_ = s.Store.InsertAdminNotification(domain.AdminNotification{
			ID:      "AN-" + strconv.FormatInt(time.Now().UnixMicro(), 10),
			Kind:    "call-missed",
			Message: "Missed call from " + e.from,
			Time:    "just now",
			Read:    false,
			Href:    routeFor("staff", e.threadID),
		})
		s.pushCallToRole(push.RoleAdmin, "Missed call from "+e.from, body, routeFor("staff", e.threadID), "fayfort-missed-"+e.callID)
	default:
		_ = s.Store.InsertCustomerNotification(domain.CustomerNotification{
			ID:    "cn-" + strconv.FormatInt(time.Now().UnixMicro(), 10),
			Title: "Missed call from " + e.from,
			Body:  body,
			At:    "just now",
			Read:  false,
			// No RequestID: the portal maps that to a dashboard route for the
			// request in question, and a chat thread is not one.
		})
		s.pushCallToRole(push.RoleCustomer, "Missed call from "+e.from, body, routeFor("customer", e.threadID), "fayfort-missed-"+e.callID)
	}
	// The caller got live feedback over the socket when they were engaged; the
	// push covers a caller whose tab was closed or backgrounded.
	if e.fromEmail != "" {
		s.Push.DispatchUser(e.fromEmail, push.Payload{
			Title:              "No answer",
			Body:               "Your " + callModeWord(e.mode) + " call wasn't answered.",
			URL:                routeFor(e.role, e.threadID),
			Tag:                "fayfort-noanswer-" + e.callID,
			ID:                 "na-" + strconv.FormatInt(time.Now().UnixMicro(), 10),
			At:                 time.Now().UTC().Format(time.RFC3339),
			Icon:               push.DefaultIcon,
			Badge:              push.DefaultBadge,
			RequireInteraction: true,
			Vibrate:            []int{200, 60, 200},
		})
	}
}

// pushCallToRole delivers an attention-grabbing call notification to a role's
// devices: it stays on screen (requireInteraction) and rings with a long
// pattern instead of the chat default.
func (s *Server) pushCallToRole(role, title, body, url, tag string) {
	s.Push.Dispatch(role, push.Payload{
		Title:              title,
		Body:               body,
		URL:                url,
		Tag:                tag,
		ID:                 tag + "-" + strconv.FormatInt(time.Now().UnixMicro(), 10),
		At:                 time.Now().UTC().Format(time.RFC3339),
		Icon:               push.DefaultIcon,
		Badge:              push.DefaultBadge,
		RequireInteraction: true,
		Vibrate:            []int{300, 90, 300, 90, 700},
	})
}

// pushRoleFor maps a conversation side to the push audience that governs it.
func pushRoleFor(side string) string {
	if side == "staff" {
		return push.RoleAdmin
	}
	return push.RoleCustomer
}

// routeFor is where the app should reopen when a call notification is tapped.
func routeFor(side, threadID string) string {
	if side == "staff" {
		if threadID != "" {
			return "/admin/messages/" + threadID
		}
		return "/admin/messages"
	}
	return "/chat"
}

// callModeWord is the bare medium ("audio"/"video") used in sentences.
func callModeWord(mode string) string {
	if mode == "audio" {
		return "audio"
	}
	return "video"
}

// callModePhrase is "an audio call"/"a video call" for notification bodies.
func callModePhrase(mode string) string {
	if mode == "audio" {
		return "an audio call"
	}
	return "a video call"
}
