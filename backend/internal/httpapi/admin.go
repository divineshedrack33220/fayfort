package httpapi

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"fayfort/backend/internal/domain"
	"fayfort/backend/internal/push"
	"fayfort/backend/internal/store"
)

// ---------------------------------------------------------------------------
// Dashboard / analytics

func (s *Server) handleAdminDashboard(w http.ResponseWriter, r *http.Request) {
	customers, err := s.Store.AllCustomers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load customers")
		return
	}
	quotes, err := s.Store.AllQuotes()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load quotes")
		return
	}
	orders, err := s.Store.AllOrders()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load orders")
		return
	}
	requests, err := s.Store.AllRequests()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load requests")
		return
	}
	suppliers, err := s.Store.AllSuppliers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load suppliers")
		return
	}
	activity, err := s.Store.AllActivity()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load activity")
		return
	}
	threads, err := s.Store.AllThreads()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load threads")
		return
	}
	inspections, err := s.Store.AllInspections()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load inspections")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"kpis":                 domain.AdminKpis(customers, quotes, requests),
		"pipeline":             domain.RequestPipeline(requests),
		"statusCounts":         domain.StatusCounts(requests),
		"requestsThisWeek":     domain.RequestsThisWeek(requests),
		"ordersByMonth":        domain.OrdersByMonth(orders),
		"topRequestedProducts": domain.TopProducts(requests),
		"topCustomers":         domain.TopCustomers(customers),
		"topSuppliers":         domain.TopSuppliers(suppliers),
		"activity":             activity,
		"activeOrders":         domain.ActiveOrdersCount(orders),
		"conversionRate":       domain.ConversionRate(requests, orders),
		"pendingActions":       domain.PendingActionsCount(threads, inspections, quotes),
	})
}

func (s *Server) handleAnalytics(w http.ResponseWriter, r *http.Request) {
	customers, err := s.Store.AllCustomers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load customers")
		return
	}
	orders, err := s.Store.AllOrders()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load orders")
		return
	}
	requests, err := s.Store.AllRequests()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load requests")
		return
	}
	suppliers, err := s.Store.AllSuppliers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load suppliers")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ordersByMonth":        domain.OrdersByMonth(orders),
		"topRequestedProducts": domain.TopProducts(requests),
		"topCustomers":         domain.TopCustomers(customers),
		"topSuppliers":         domain.TopSuppliers(suppliers),
		"conversionRate":       domain.ConversionRate(requests, orders),
		"activeOrders":         domain.ActiveOrdersCount(orders),
	})
}

func (s *Server) handleActivity(w http.ResponseWriter, r *http.Request) {
	activity, err := s.Store.AllActivity()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load activity")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"activity": activity})
}

func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, domain.Settings{Demo: false})
}

// ---------------------------------------------------------------------------
// Requests

func (s *Server) handleListRequests(w http.ResponseWriter, r *http.Request) {
	requests, err := s.Store.AllRequests()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load requests")
		return
	}
	q := r.URL.Query().Get("q")
	status := r.URL.Query().Get("status")
	var statusPtr *domain.RequestStatus
	if status != "" {
		parsed := domain.RequestStatus(status)
		statusPtr = &parsed
	}
	writeJSON(w, http.StatusOK, map[string]any{"requests": domain.FilterRequests(requests, statusPtr, q)})
}

type requestDetail struct {
	ID           string                       `json:"id"`
	Product      string                       `json:"product"`
	Category     string                       `json:"category"`
	Customer     string                       `json:"customer"`
	City         string                       `json:"city"`
	Quantity     int                          `json:"quantity"`
	Budget       float64                      `json:"budget"`
	Currency     string                       `json:"currency"`
	ContactPhone string                       `json:"contactPhone,omitempty"`
	Status       domain.RequestStatus         `json:"status"`
	Date         string                       `json:"date"`
	ImageURLs    []string                     `json:"imageUrls,omitempty"`
	Timeline     []domain.PortalTimelineStage `json:"timeline"`
	Quote        *domain.Quote                `json:"quote,omitempty"`
	Activity     []domain.Activity            `json:"activity"`
}

func (s *Server) handleRequestDetail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	req, err := s.Store.RequestByID(id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "request not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load request")
		return
	}
	quotes, err := s.Store.AllQuotes()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load quotes")
		return
	}
	activity, err := s.Store.AllActivity()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load activity")
		return
	}
	var linked *domain.Quote
	for i := range quotes {
		if quotes[i].RequestID == id {
			copy := quotes[i]
			linked = &copy
		}
	}
	var reqActivity []domain.Activity
	for _, a := range activity {
		if a.RequestID == id {
			reqActivity = append(reqActivity, a)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"request": requestDetail{
		ID: req.ID, Product: req.Product, Category: req.Category, Customer: req.Customer,
		City: req.City, Quantity: req.Quantity, Budget: req.Budget, Currency: req.Currency,
		Status: req.Status, Date: req.Date, ContactPhone: req.ContactPhone,
		Timeline:  domain.TimelineFromStatus(req.Status),
		ImageURLs: req.ImageURLs,
		Quote:     linked, Activity: reqActivity,
	}})
}

type statusUpdate struct {
	Status domain.RequestStatus `json:"status"`
}

func (s *Server) handleUpdateRequestStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req statusUpdate
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	valid := false
	for _, st := range domain.RequestStatuses {
		if st == req.Status {
			valid = true
			break
		}
	}
	if !valid {
		writeError(w, http.StatusBadRequest, "unknown request status")
		return
	}
	updated, err := s.Store.UpdateRequestStatus(id, req.Status)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "request not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update request")
		return
	}
	_ = s.Store.InsertActivity(domain.Activity{
		ID:    "a" + strconv.FormatInt(time.Now().UnixMicro(), 10),
		Actor: currentUser(r).Name, Action: "moved", Target: fmt.Sprintf("%s to %s", id, req.Status),
		At: "just now", Tone: domain.ToneInfo,
	})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "updated": updated})
}

// nextQuoteID scans existing quotes and returns the next sequential id.
func nextQuoteID(quotes []domain.Quote) string {
	max := 2040
	for _, q := range quotes {
		if strings.HasPrefix(q.ID, "QT-") {
			if n, err := strconv.Atoi(strings.TrimPrefix(q.ID, "QT-")); err == nil && n > max {
				max = n
			}
		}
	}
	return fmt.Sprintf("QT-%d", max+1)
}

type issueQuoteRequest struct {
	Supplier  string             `json:"supplier"`
	ValueUSD  float64            `json:"valueUsd"`
	MarginBps int                `json:"marginBps"`
	Status    domain.QuoteStatus `json:"status"`
	ImageURLs []string           `json:"imageUrls"`
}

func (s *Server) handleIssueQuote(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	req, err := s.Store.RequestByID(id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "request not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load request")
		return
	}
	var body issueQuoteRequest
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.ValueUSD <= 0 {
		writeError(w, http.StatusBadRequest, "valueUsd must be positive")
		return
	}
	quotes, err := s.Store.AllQuotes()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load quotes")
		return
	}
	status := body.Status
	if status == "" {
		status = domain.QuoteSent
	}
	quote := domain.Quote{
		ID:        nextQuoteID(quotes),
		RequestID: req.ID,
		Product:   req.Product,
		Customer:  req.Customer,
		Supplier:  body.Supplier,
		ValueUSD:  body.ValueUSD,
		MarginBps: body.MarginBps,
		Status:    status,
		IssuedAt:  time.Now().Format("Jan 2, 2006"),
		ExpiresAt: time.Now().AddDate(0, 0, 14).Format("Jan 2, 2006"),
		ImageURLs: cleanImageURLs(body.ImageURLs),
	}
	if quote.Supplier == "" {
		quote.Supplier = "To be confirmed"
	}
	if err := s.Store.InsertQuote(quote); err != nil {
		writeError(w, http.StatusInternalServerError, "could not store quote")
		return
	}
	s.notifyCustomer(req.Product+" — quote ready",
		fmt.Sprintf("Your quote from %s is waiting on My Requests.", quote.Supplier), req.ID)
	if req.Status != domain.RequestQuoteReady {
		_, _ = s.Store.UpdateRequestStatus(req.ID, domain.RequestQuoteReady)
	}
	_ = s.Store.InsertActivity(domain.Activity{
		ID:    "a" + strconv.FormatInt(time.Now().UnixMicro(), 10),
		Actor: currentUser(r).Name, Action: "issued quote", Target: quote.ID,
		RequestID: req.ID, At: "just now", Tone: domain.ToneSuccess,
	})
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "quote": quote})
}

func (s *Server) handleListQuotes(w http.ResponseWriter, r *http.Request) {
	quotes, err := s.Store.AllQuotes()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load quotes")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"quotes": quotes})
}

// ---------------------------------------------------------------------------
// Orders, shipments, inspections, customers, suppliers

func listOr(w http.ResponseWriter, items any, err error) {
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load data")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleListOrders(w http.ResponseWriter, r *http.Request) {
	orders, err := s.Store.AllOrders()
	listOr(w, map[string]any{"orders": orders}, err)
}

// orderStatusLabels maps order stages to their plain-language display names,
// used when telling customers about stage changes.
var orderStatusLabels = map[domain.OrderStatus]string{
	domain.OrderPayment:            "Payment",
	domain.OrderPurchasing:         "Purchasing",
	domain.OrderSupplierProcessing: "Supplier processing",
	domain.OrderInspection:         "Inspection",
	domain.OrderWarehouse:          "Warehouse",
	domain.OrderShipping:           "Shipping",
	domain.OrderDelivered:          "Delivered",
}

func orderStatusLabel(status domain.OrderStatus) string {
	if label, ok := orderStatusLabels[status]; ok {
		return label
	}
	return string(status)
}

// nextOrderID scans existing orders and returns the next sequential id.
func nextOrderID(orders []domain.Order) string {
	max := 1216
	for _, o := range orders {
		if strings.HasPrefix(o.ID, "ORD-") {
			if n, err := strconv.Atoi(strings.TrimPrefix(o.ID, "ORD-")); err == nil && n > max {
				max = n
			}
		}
	}
	return fmt.Sprintf("ORD-%d", max+1)
}

// handleAdvanceOrder moves an order one stage forward. Part of the
// autonomous flow: confirming a stage rolls the order into the next one.
func (s *Server) handleAdvanceOrder(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	order, err := s.Store.OrderByID(id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "order not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load order")
		return
	}
	idx := -1
	for i, st := range domain.OrderStatuses {
		if order.Status == st {
			idx = i
			break
		}
	}
	if idx == -1 || idx == len(domain.OrderStatuses)-1 {
		writeError(w, http.StatusConflict, "order is already at its final stage")
		return
	}
	next := domain.OrderStatuses[idx+1]
	updated, err := s.Store.UpdateOrderStatus(id, next)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update order")
		return
	}
	_ = s.Store.InsertActivity(domain.Activity{
		ID:    "a" + strconv.FormatInt(time.Now().UnixMicro(), 10),
		Actor: currentUser(r).Name, Action: "advanced order to " + string(next), Target: id,
		RequestID: order.RequestID, At: "just now", Tone: domain.ToneSuccess,
	})
	s.notifyCustomer(updated.Product+" — order update",
		fmt.Sprintf("Your order is now at %s.", orderStatusLabel(next)), updated.RequestID)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "order": updated})
}

type setOrderStatusRequest struct {
	Status domain.OrderStatus `json:"status"`
}

// handleSetOrderStatus is the manual override: an admin can set any stage
// directly (corrections or fallbacks) without re-running the whole flow.
func (s *Server) handleSetOrderStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body setOrderStatusRequest
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	valid := false
	for _, st := range domain.OrderStatuses {
		if body.Status == st {
			valid = true
			break
		}
	}
	if !valid {
		writeError(w, http.StatusBadRequest, "unknown order stage")
		return
	}
	updated, err := s.Store.UpdateOrderStatus(id, body.Status)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "order not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update order")
		return
	}
	_ = s.Store.InsertActivity(domain.Activity{
		ID:    "a" + strconv.FormatInt(time.Now().UnixMicro(), 10),
		Actor: currentUser(r).Name, Action: "set order stage to " + string(body.Status), Target: id,
		RequestID: updated.RequestID, At: "just now", Tone: domain.ToneNeutral,
	})
	s.notifyCustomer(updated.Product+" — order update",
		fmt.Sprintf("Your order is now at %s.", orderStatusLabel(body.Status)), updated.RequestID)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "order": updated})
}

func (s *Server) handleListShipments(w http.ResponseWriter, r *http.Request) {
	shipments, err := s.Store.AllShipments()
	listOr(w, map[string]any{"shipments": shipments}, err)
}

func (s *Server) handleListInspections(w http.ResponseWriter, r *http.Request) {
	inspections, err := s.Store.AllInspections()
	listOr(w, map[string]any{"inspections": inspections}, err)
}

func (s *Server) handleListCustomers(w http.ResponseWriter, r *http.Request) {
	customers, err := s.Store.AllCustomers()
	listOr(w, map[string]any{"customers": customers}, err)
}

// handleListUsers answers every account (admin + customers) that can sign in,
// so the staff console can see who is registered. Password hashes are never
// returned.
func (s *Server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := s.Store.AllUsers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load accounts")
		return
	}
	accounts := make([]map[string]any, 0, len(users))
	for _, u := range users {
		accounts = append(accounts, map[string]any{
			"id": u.ID, "name": u.Name, "email": u.Email,
			"role": u.Role, "status": u.Status, "avatarUrl": u.AvatarURL, "createdAt": u.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"accounts": accounts})
}

func (s *Server) handleListSuppliers(w http.ResponseWriter, r *http.Request) {
	sups, err := s.Store.AllSuppliers()
	listOr(w, map[string]any{"suppliers": sups}, err)
}

// ---------------------------------------------------------------------------
// Messages (support threads)

func (s *Server) handleListThreads(w http.ResponseWriter, r *http.Request) {
	threads, err := s.Store.AllThreads()
	listOr(w, map[string]any{"threads": threads}, err)
}

// handleThreadUnreadTotal answers the sum of unread threads for the staff
// console's sidebar badge, so clients don't fetch every thread just to count.
func (s *Server) handleThreadUnreadTotal(w http.ResponseWriter, r *http.Request) {
	threads, err := s.Store.AllThreads()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load threads")
		return
	}
	total := 0
	for _, t := range threads {
		total += t.Unread
	}
	writeJSON(w, http.StatusOK, map[string]any{"unread": total})
}

type threadReplyRequest struct {
	Text        string                    `json:"text"`
	Attachments []domain.ThreadAttachment `json:"attachments,omitempty"`
}

func (s *Server) handleThreadReply(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	thread, err := s.Store.ThreadByID(id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "thread not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load thread")
		return
	}
	var body threadReplyRequest
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	attachments := cleanAttachments(body.Attachments)
	if strings.TrimSpace(body.Text) == "" && len(attachments) == 0 {
		writeError(w, http.StatusBadRequest, "a message or attachment is required")
		return
	}
	user := currentUser(r)
	message := domain.ThreadMessage{
		ID:          fmt.Sprintf("%s-%d", thread.ID, len(thread.Messages)+1),
		From:        "staff",
		Author:      user.Name,
		Text:        body.Text,
		At:          time.Now().Format("Today, 15:04"),
		Attachments: attachments,
	}
	hasUnread := false
	for _, m := range thread.Messages {
		if m.From == "customer" {
			hasUnread = true
			break
		}
	}
	thread.Messages = append(thread.Messages, message)
	thread.Unread = 0
	thread.CustomerUnread++
	if hasUnread || thread.Status == domain.ThreadNeedsReply {
		thread.Status = domain.ThreadOpen
	}
	thread.LastActive = "just now"
	if err := s.Store.SaveThread(thread); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save thread")
		return
	}
	s.hub.notifyMessage(thread.ID)
	// The customer may have the app closed, so push the reply as well as
	// recording the unread badge.
	s.pushToRole(push.RoleCustomer,
		"New message from "+user.Name,
		chatPreview(body.Text, len(attachments)),
		"/chat",
		"fayfort-chat",
		true)
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "thread": thread})
}

func (s *Server) handleThreadRead(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	thread, err := s.Store.ThreadByID(id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "thread not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load thread")
		return
	}
	thread.Unread = 0
	if thread.Status == domain.ThreadNeedsReply {
		thread.Status = domain.ThreadOpen
	}
	if err := s.Store.SaveThread(thread); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save thread")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "thread": thread})
}

// ---------------------------------------------------------------------------
// Notifications

func (s *Server) handleAdminNotifications(w http.ResponseWriter, r *http.Request) {
	items, err := s.Store.AllAdminNotifications()
	listOr(w, map[string]any{"notifications": items, "unread": countUnreadAdmin(items)}, err)
}

// notifyAdmin queues a fresh notification for the staff console. Failures are
// deliberately swallowed so the source action never fails because of the bell.
func (s *Server) notifyAdmin(kind, message, href string) {
	_ = s.Store.InsertAdminNotification(domain.AdminNotification{
		ID:      "AN-" + strconv.FormatInt(time.Now().UnixMicro(), 10),
		Kind:    kind,
		Message: message,
		Time:    "just now",
		Read:    false,
		Href:    href,
	})
	s.Push.Dispatch(push.RoleAdmin, push.Payload{
		Title:              adminPushTitle(kind),
		Body:               message,
		URL:                adminPushURL(kind, href),
		Tag:                "fayfort-admin-" + kind,
		ID:                 "AN-" + strconv.FormatInt(time.Now().UnixMicro(), 10),
		At:                 time.Now().UTC().Format(time.RFC3339),
		Icon:               push.DefaultIcon,
		Badge:              push.DefaultBadge,
		RequireInteraction: true,
	})
}

// notifyCustomer queues a fresh notification for a portal user. Failures are
// swallowed so the source action never fails because of the bell.
func (s *Server) notifyCustomer(title, body, requestID string) {
	_ = s.Store.InsertCustomerNotification(domain.CustomerNotification{
		ID:        "cn-" + strconv.FormatInt(time.Now().UnixMicro(), 10),
		Title:     title,
		Body:      body,
		At:        "just now",
		Read:      false,
		RequestID: requestID,
	})
	target := customerPushTarget(requestID)
	s.pushToRole(push.RoleCustomer, title, body, target, "fayfort-customer", true)
}

// customerPushTarget is the portal page a customer's push notification opens.
// The portal serves request detail at /dashboard/{id} (app/dashboard/[id]); there
// is no /requests/{id} route, so pointing there would dead-end on a 404.
func customerPushTarget(requestID string) string {
	if requestID == "" {
		return "/notifications"
	}
	return "/dashboard/" + requestID
}

// pushToRole delivers a push to a role's devices without touching the in-app
// notification list. Live chat messages use this: they already surface through
// the unread badge and WebSocket, so a customer with the app closed should not
// miss them either.
func (s *Server) pushToRole(role, title, body, url, tag string, requireInteraction bool) {
	s.Push.Dispatch(role, push.Payload{
		Title:              title,
		Body:               body,
		URL:                url,
		Tag:                tag,
		ID:                 tag + "-" + strconv.FormatInt(time.Now().UnixMicro(), 10),
		At:                 time.Now().UTC().Format(time.RFC3339),
		Icon:               push.DefaultIcon,
		Badge:              push.DefaultBadge,
		RequireInteraction: requireInteraction,
	})
}

// chatPreview trims a chat message into a one-line push body.
func chatPreview(text string, attachments int) string {
	preview := strings.TrimSpace(strings.Join(strings.Fields(text), " "))
	switch {
	case preview == "" && attachments > 0:
		return fmt.Sprintf("Sent %d attachment(s)", attachments)
	case preview == "":
		return "Sent you a new message"
	case len(preview) > 140:
		// Truncate on a rune boundary: cutting raw bytes would split multi-byte
		// characters and produce invalid UTF-8 in the notification body.
		runes := []rune(preview)
		if len(runes) <= 140 {
			return preview
		}
		return strings.TrimRight(string(runes[:140]), " ") + "…"
	default:
		return preview
	}
}

// adminPushTitle maps a notification kind to a short OS-level title.
func adminPushTitle(kind string) string {
	switch kind {
	case "quote":
		return "New quote to review"
	case "request":
		return "New sourcing request"
	case "inspection":
		return "Inspection update"
	case "shipment":
		return "Shipment update"
	case "order":
		return "Order update"
	case "customer":
		return "Customer message"
	default:
		return "Fayfort update"
	}
}

// adminPushURL resolves where a staff notification should open. The in-app href
// wins when it is a safe absolute path so deep links keep working.
func adminPushURL(kind, href string) string {
	if href != "" && strings.HasPrefix(href, "/") && !strings.HasPrefix(href, "//") {
		return href
	}
	switch kind {
	case "quote":
		return "/admin/quotes"
	case "request":
		return "/admin/requests"
	default:
		return "/admin/notifications"
	}
}

func countUnreadAdmin(items []domain.AdminNotification) int {
	n := 0
	for _, item := range items {
		if !item.Read {
			n++
		}
	}
	return n
}

func (s *Server) handleAdminNotificationsRead(w http.ResponseWriter, r *http.Request) {
	if err := s.Store.MarkAllAdminNotificationsRead(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update notifications")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAdminNotificationRead(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.Store.MarkAdminNotificationRead(id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "notification not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "could not update notification")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// ---------------------------------------------------------------------------
// Search

type searchEntry struct {
	Kind     string `json:"kind"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	Href     string `json:"href"`
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	if q == "" {
		writeJSON(w, http.StatusOK, map[string]any{"results": []searchEntry{}})
		return
	}
	var results []searchEntry
	appendMatches := func(kind, title, subtitle, href string, haystack ...string) {
		joined := strings.ToLower(strings.Join(haystack, " "))
		if strings.Contains(joined, q) {
			results = append(results, searchEntry{kind, title, subtitle, href})
		}
	}
	if customers, err := s.Store.AllCustomers(); err == nil {
		for _, c := range customers {
			appendMatches("customer", c.Name, c.City, "/admin/customers/"+c.ID, c.ID, c.Name, c.Email, c.Company, c.City)
		}
	}
	if sups, err := s.Store.AllSuppliers(); err == nil {
		for _, sp := range sups {
			appendMatches("supplier", sp.Name, sp.Category, "/admin/suppliers/"+sp.ID, sp.ID, sp.Name, sp.Category, sp.City)
		}
	}
	if requests, err := s.Store.AllRequests(); err == nil {
		for _, req := range requests {
			appendMatches("request", fmt.Sprintf("%s — %s", req.Product, req.Customer), req.ID, "/admin/requests/"+req.ID, req.ID, req.Product, req.Customer, req.City)
		}
	}
	if quotes, err := s.Store.AllQuotes(); err == nil {
		for _, qte := range quotes {
			appendMatches("quote", fmt.Sprintf("%s — %s", qte.Product, qte.Customer), qte.ID, "/admin/requests/"+qte.RequestID, qte.ID, qte.Product, qte.Customer)
		}
	}
	if orders, err := s.Store.AllOrders(); err == nil {
		for _, o := range orders {
			appendMatches("order", fmt.Sprintf("%s — %s", o.Product, o.Customer), o.ID, "/admin/orders/"+o.ID, o.ID, o.Product, o.Customer)
		}
	}
	if shipments, err := s.Store.AllShipments(); err == nil {
		for _, sh := range shipments {
			appendMatches("shipment", fmt.Sprintf("%s — %s", sh.Product, sh.Customer), sh.ID, "/admin/shipments/"+sh.ID, sh.ID, sh.Product, sh.Customer)
		}
	}
	if inspections, err := s.Store.AllInspections(); err == nil {
		for _, in := range inspections {
			appendMatches("inspection", fmt.Sprintf("%s — %s", in.Product, in.Customer), in.ID, "/admin/inspections/"+in.ID, in.ID, in.Product, in.Customer)
		}
	}
	if thread, err := s.Store.AllThreads(); err == nil {
		for _, th := range thread {
			appendMatches("message", th.Subject, th.Customer, "/admin/messages/"+th.ID, th.ID, th.Subject, th.Customer)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}
