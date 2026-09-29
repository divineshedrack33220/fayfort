package httpapi

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"fayfort/backend/internal/domain"
	"fayfort/backend/internal/push"
	"fayfort/backend/internal/store"
)

// ---------------------------------------------------------------------------
// Estimate

func (s *Server) handleEstimate(w http.ResponseWriter, r *http.Request) {
	var input domain.EstimateInput
	if err := readJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	result := domain.ComputeEstimate(&input)
	if result == nil {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": result})
}

type simplifiedEstimateRequest struct {
	UnitCostUSD   float64              `json:"unitCostUsd"`
	Quantity      int                  `json:"quantity"`
	TransportMode domain.TransportMode `json:"transportMode"`
	WeightKG      float64              `json:"weightKg,omitempty"`
	VolumeCBM     float64              `json:"volumeCbm,omitempty"`
	DutyRate      float64              `json:"dutyRate,omitempty"`
	DoorDelivery  *bool                `json:"doorDelivery,omitempty"`
}

func (s *Server) handleSimplifiedEstimate(w http.ResponseWriter, r *http.Request) {
	var body simplifiedEstimateRequest
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	result := domain.ComputeSimplifiedEstimate(body.UnitCostUSD, body.Quantity, body.TransportMode,
		body.WeightKG, body.VolumeCBM, body.DutyRate, body.DoorDelivery, true)
	if result == nil {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": result})
}

// ---------------------------------------------------------------------------
// Marketing

type contactRequest struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Message string `json:"message"`
}

func (s *Server) handleContact(w http.ResponseWriter, r *http.Request) {
	var body contactRequest
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Name == "" || body.Email == "" || body.Message == "" {
		writeError(w, http.StatusBadRequest, "name, email and message are required")
		return
	}
	id, err := s.Store.InsertContact(body.Name, body.Email, body.Message)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not store message")
		return
	}
	_ = s.Store.InsertActivity(domain.Activity{
		ID:    "a" + strconv.FormatInt(time.Now().UnixMicro(), 10),
		Actor: body.Name, Action: "sent a contact message", Target: "Fayfort",
		At: "just now", Tone: domain.ToneInfo,
	})
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "id": id})
}

type createRequest struct {
	Product      string   `json:"product"`
	Category     string   `json:"category"`
	Customer     string   `json:"customer"`
	City         string   `json:"city"`
	Quantity     int      `json:"quantity"`
	Budget       float64  `json:"budget"`
	Currency     string   `json:"currency"`
	ContactPhone string   `json:"contactPhone"`
	SupplierHint string   `json:"supplierHint"`
	Destination  string   `json:"destination"`
	Notes        string   `json:"notes"`
	ImageURLs    []string `json:"imageUrls"`
}

func (s *Server) handleCreateRequest(w http.ResponseWriter, r *http.Request) {
	var body createRequest
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(body.Product) == "" || body.Quantity < 1 {
		writeError(w, http.StatusBadRequest, "product and a quantity of at least 1 are required")
		return
	}
	if strings.TrimSpace(body.ContactPhone) == "" {
		writeError(w, http.StatusBadRequest, "a contact phone or WhatsApp number is required")
		return
	}
	if body.Currency == "" {
		body.Currency = "NGN"
	}
	requests, err := s.Store.AllRequests()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load requests")
		return
	}
	nextID := 1047
	for _, req := range requests {
		if strings.HasPrefix(req.ID, "REQ-") {
			if n, err := strconv.Atoi(strings.TrimPrefix(req.ID, "REQ-")); err == nil && n > nextID {
				nextID = n
			}
		}
	}
	if body.City == "" {
		body.City = "—"
	}
	submittedBy := ""
	if user, ok, err := s.userFromRequest(r); err == nil && ok && user.Name != "" {
		body.Customer = user.Name
		submittedBy = user.Email
	}
	newReq := domain.SourcingRequest{
		ID:           fmt.Sprintf("REQ-%d", nextID+1),
		Product:      body.Product,
		Category:     body.Category,
		Customer:     orDefault(body.Customer, "New Customer"),
		City:         body.City,
		Quantity:     body.Quantity,
		Budget:       body.Budget,
		Currency:     body.Currency,
		Status:       domain.RequestSubmitted,
		Date:         time.Now().Format("Jan 2, 2006"),
		SubmittedBy:  submittedBy,
		SupplierHint: body.SupplierHint,
		Destination:  body.Destination,
		NotesBody:    body.Notes,
		ContactPhone: strings.TrimSpace(body.ContactPhone),
		ImageURLs:    cleanImageURLs(body.ImageURLs),
	}
	if err := s.Store.InsertRequest(newReq); err != nil {
		writeError(w, http.StatusInternalServerError, "could not store request")
		return
	}
	s.notifyAdmin("request",
		fmt.Sprintf("New sourcing request received: %s (%s).", newReq.Product, newReq.Customer),
		"/admin/requests/"+newReq.ID)
	s.notifyCustomer(newReq.Product+" — received",
		"We've got your brief and our sourcing team will review it shortly.",
		newReq.ID)
	_ = s.Store.InsertActivity(domain.Activity{
		ID:    "a" + strconv.FormatInt(time.Now().UnixMicro(), 10),
		Actor: newReq.Customer, Action: "submitted a new sourcing request for", Target: newReq.Product,
		RequestID: newReq.ID, At: "just now", Tone: domain.ToneInfo,
	})
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "request": newReq})
}

func orDefault(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

// cleanImageURLs drops empty entries (e.g. a failed upload) before anything
// gets persisted, so consumers can rely on the list holding only real URLs.
func cleanImageURLs(urls []string) []string {
	out := make([]string, 0, len(urls))
	for _, url := range urls {
		if url = strings.TrimSpace(url); url != "" {
			out = append(out, url)
		}
	}
	return out
}

// ---------------------------------------------------------------------------
// Customer portal

func (s *Server) handlePortalRequests(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	requests, err := s.Store.AllRequests()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load requests")
		return
	}
	quotes, err := s.Store.AllQuotes()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load quotes")
		return
	}
	quoteImageByRequest := make(map[string][]string, len(quotes))
	for _, quote := range quotes {
		if len(quote.ImageURLs) > 0 {
			quoteImageByRequest[quote.RequestID] = quote.ImageURLs
		}
	}
	type portalRequest struct {
		ID             string                       `json:"id"`
		Product        string                       `json:"product"`
		Quantity       int                          `json:"quantity"`
		Budget         float64                      `json:"budget"`
		Status         domain.RequestStatus         `json:"status"`
		Date           string                       `json:"date"`
		Timeline       []domain.PortalTimelineStage `json:"timeline"`
		ImageURLs      []string                     `json:"imageUrls,omitempty"`
		QuoteImageURLs []string                     `json:"quoteImageUrls,omitempty"`
	}
	out := make([]portalRequest, 0)
	for _, req := range requests {
		if req.Customer == user.Name {
			out = append(out, portalRequest{
				ID: req.ID, Product: req.Product, Quantity: req.Quantity, Budget: req.Budget,
				Status: req.Status, Date: req.Date, Timeline: domain.TimelineFromStatus(req.Status),
				ImageURLs:      req.ImageURLs,
				QuoteImageURLs: quoteImageByRequest[req.ID],
			})
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"requests": out})
}

// ---------------------------------------------------------------------------
// Quotes (customer-side)

type portalQuote struct {
	ID             string                       `json:"id"`
	RequestID      string                       `json:"requestId"`
	Product        string                       `json:"product"`
	Supplier       string                       `json:"supplier"`
	ValueUSD       float64                      `json:"valueUsd"`
	MarginBps      int                          `json:"marginBps"`
	Status         domain.QuoteStatus           `json:"status"`
	IssuedAt       string                       `json:"issuedAt"`
	ExpiresAt      string                       `json:"expiresAt"`
	DecidedAt      string                       `json:"decidedAt,omitempty"`
	DecisionReason string                       `json:"decisionReason,omitempty"`
	ImageURLs      []string                     `json:"imageUrls,omitempty"`
	RequestStatus  domain.RequestStatus         `json:"requestStatus"`
	Quantity       int                          `json:"quantity"`
	Budget         float64                      `json:"budget"`
	Timeline       []domain.PortalTimelineStage `json:"timeline"`
}

func (s *Server) handlePortalQuotes(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	quotes, err := s.Store.AllQuotes()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load quotes")
		return
	}
	requests, err := s.Store.AllRequests()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load requests")
		return
	}
	requestByID := make(map[string]domain.SourcingRequest, len(requests))
	for _, req := range requests {
		requestByID[req.ID] = req
	}
	out := make([]portalQuote, 0)
	for _, quote := range quotes {
		if quote.Customer != user.Name {
			continue
		}
		req, ok := requestByID[quote.RequestID]
		if !ok {
			continue
		}
		out = append(out, toPortalQuote(quote, req))
	}
	writeJSON(w, http.StatusOK, map[string]any{"quotes": out})
}

func toPortalQuote(quote domain.Quote, req domain.SourcingRequest) portalQuote {
	return portalQuote{
		ID: quote.ID, RequestID: quote.RequestID, Product: quote.Product,
		Supplier: quote.Supplier, ValueUSD: quote.ValueUSD, MarginBps: quote.MarginBps,
		Status: quote.Status, IssuedAt: quote.IssuedAt, ExpiresAt: quote.ExpiresAt,
		DecidedAt: quote.DecidedAt, DecisionReason: quote.DecisionReason,
		ImageURLs: quote.ImageURLs, RequestStatus: req.Status, Quantity: req.Quantity,
		Budget: req.Budget, Timeline: domain.TimelineFromStatus(req.Status),
	}
}

type quoteDecisionRequest struct {
	Decision domain.QuoteStatus `json:"decision"`
	Reason   string             `json:"reason,omitempty"`
}

func (s *Server) handlePortalQuoteDecision(w http.ResponseWriter, r *http.Request) {
	requestID := r.PathValue("requestId")
	user := currentUser(r)

	var body quoteDecisionRequest
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Decision != domain.QuoteApproved && body.Decision != domain.QuoteDeclined {
		writeError(w, http.StatusBadRequest, "decision must be APPROVED or DECLINED")
		return
	}

	quotes, err := s.Store.AllQuotes()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load quotes")
		return
	}
	var quote *domain.Quote
	for i := range quotes {
		if quotes[i].RequestID == requestID {
			copy := quotes[i]
			quote = &copy
			break
		}
	}
	if quote == nil {
		writeError(w, http.StatusNotFound, "no quote for this request")
		return
	}
	if quote.Customer != user.Name {
		writeError(w, http.StatusNotFound, "no quote for this request")
		return
	}
	if quote.Status == domain.QuoteApproved || quote.Status == domain.QuoteDeclined {
		writeError(w, http.StatusConflict, "this quote has already been decided")
		return
	}

	decidedAt := time.Now().Format("Jan 2, 15:04")
	if err := s.Store.UpdateQuoteDecision(requestID, body.Decision, decidedAt, body.Reason); err != nil {
		writeError(w, http.StatusInternalServerError, "could not record the decision")
		return
	}

	next := domain.RequestApproved
	action := "approved"
	tone := domain.ToneSuccess
	if body.Decision == domain.QuoteDeclined {
		next = domain.RequestQuoteReady
		action = "declined"
		tone = domain.ToneDanger
	}
	if _, err := s.Store.UpdateRequestStatus(requestID, next); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update the request")
		return
	}
	_ = s.Store.InsertActivity(domain.Activity{
		ID:    "a" + strconv.FormatInt(time.Now().UnixMicro(), 10),
		Actor: user.Name, Action: action, Target: fmt.Sprintf("quote %s for %s", quote.ID, requestID),
		RequestID: requestID, At: "just now", Tone: tone,
	})

	// Autonomous flow: approving a quote opens the order automatically at the
	// first stage (PAYMENT), so the admin never has to create it by hand.
	var createdOrder *domain.Order
	if body.Decision == domain.QuoteApproved {
		orders, err := s.Store.AllOrders()
		if err == nil {
			qty := 0
			if requests, err := s.Store.AllRequests(); err == nil {
				for i := range requests {
					if requests[i].ID == requestID {
						qty = requests[i].Quantity
						break
					}
				}
			}
			unit := 0.0
			if qty > 0 {
				unit = math.Round(quote.ValueUSD/float64(qty)*100) / 100
			}
			o := domain.Order{
				ID:           nextOrderID(orders),
				RequestID:    requestID,
				Customer:     quote.Customer,
				Product:      quote.Product,
				Supplier:     quote.Supplier,
				Quantity:     qty,
				UnitPriceUSD: unit,
				ValueUSD:     quote.ValueUSD,
				Status:       domain.OrderPayment,
				Date:         time.Now().Format("Jan 2, 2006"),
				ETA:          time.Now().AddDate(0, 0, 30).Format("Jan 2, 2006"),
			}
			if err := s.Store.InsertOrder(o); err == nil {
				createdOrder = &o
				_ = s.Store.InsertActivity(domain.Activity{
					ID:    "a" + strconv.FormatInt(time.Now().UnixMicro(), 10),
					Actor: user.Name, Action: "opened order " + o.ID, Target: o.ID,
					RequestID: requestID, At: "just now", Tone: domain.ToneSuccess,
				})
			}
		}
		adminHref := "/admin/requests/" + requestID
		if createdOrder != nil {
			s.notifyAdmin("quote",
				fmt.Sprintf("%s accepted quote %s for %s — order %s opened.", quote.Customer, quote.ID, quote.Product, createdOrder.ID),
				"/admin/orders/"+createdOrder.ID)
		} else {
			s.notifyAdmin("quote",
				fmt.Sprintf("%s accepted quote %s for %s.", quote.Customer, quote.ID, quote.Product),
				adminHref)
		}
	} else {
		s.notifyAdmin("quote",
			fmt.Sprintf("%s declined quote %s — %s", quote.Customer, quote.ID, requestID),
			"/admin/requests/"+requestID)
	}

	updated := *quote
	updated.Status = body.Decision
	updated.DecidedAt = decidedAt
	updated.DecisionReason = body.Reason

	requests, err := s.Store.AllRequests()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load the request")
		return
	}
	var decidedRequest *domain.SourcingRequest
	for i := range requests {
		if requests[i].ID == requestID {
			copy := requests[i]
			decidedRequest = &copy
			break
		}
	}
	if decidedRequest == nil {
		writeError(w, http.StatusNotFound, "no request for this quote")
		return
	}

	payload := map[string]any{"ok": true, "quote": toPortalQuote(updated, *decidedRequest)}
	if createdOrder != nil {
		payload["order"] = createdOrder
	}
	writeJSON(w, http.StatusOK, payload)
}

func (s *Server) handlePortalNotifications(w http.ResponseWriter, r *http.Request) {
	items, err := s.Store.AllCustomerNotifications()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load notifications")
		return
	}
	unread := 0
	for _, n := range items {
		if !n.Read {
			unread++
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"notifications": items, "unread": unread})
}

func (s *Server) handlePortalNotificationsRead(w http.ResponseWriter, r *http.Request) {
	if err := s.Store.MarkAllCustomerNotificationsRead(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update notifications")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handlePortalNotificationRead(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.Store.MarkCustomerNotificationRead(id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "notification not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "could not update notification")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// portalThreadFor user finds their support thread, creating a welcome thread
// when the account has none (e.g. freshly registered customers).
func (s *Server) portalThreadFor(user store.UserRow) (domain.Thread, error) {
	threads, err := s.Store.AllThreads()
	if err != nil {
		return domain.Thread{}, err
	}
	for _, t := range threads {
		if t.Customer == user.Name || t.Email == user.Email {
			return t, nil
		}
	}
	return domain.Thread{}, store.ErrNotFound
}

// nextThreadID returns the next TH-#### id, scanning existing threads like the
// request id generator does. Seed threads are TH-001..TH-005, so the first
// customer-created thread is TH-0006.
func nextThreadID(threads []domain.Thread) string {
	next := 0
	for _, t := range threads {
		if n, err := strconv.Atoi(strings.TrimPrefix(t.ID, "TH-")); err == nil && n > next {
			next = n
		}
	}
	return fmt.Sprintf("TH-%04d", next+1)
}

// welcomeThread builds the initial thread for a customer who has none yet,
// assigning a unique id like the request generator so multiple customers never
// collide on one id.
func (s *Server) welcomeThread(user store.UserRow) (domain.Thread, error) {
	threads, err := s.Store.AllThreads()
	if err != nil {
		return domain.Thread{}, err
	}
	return domain.Thread{
		ID: nextThreadID(threads), Customer: user.Name, Email: user.Email,
		Subject: "Welcome — how can we help?", Ref: "CHAT-0001", Unread: 0,
		Status: domain.ThreadOpen, LastActive: "just now",
		Messages: []domain.ThreadMessage{{
			ID: "THNEW-1", From: "staff", Author: "Ada Okafor",
			Text: "Hi! Welcome to Fayfort. Tell us about what you want to source and we’ll take it from there.",
			At:   time.Now().Format("Today, 15:04"),
		}},
	}, nil
}

func (s *Server) handlePortalThread(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	thread, err := s.portalThreadFor(user)
	if errors.Is(err, store.ErrNotFound) {
		thread, err = s.welcomeThread(user)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not save thread")
			return
		}
		if err := s.Store.SaveThread(thread); err != nil {
			writeError(w, http.StatusInternalServerError, "could not save thread")
			return
		}
		s.hub.notifyThreads()
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load thread")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"thread": thread})
}

func (s *Server) handlePortalThreadPost(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
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
	thread, err := s.portalThreadFor(user)
	created := false
	if errors.Is(err, store.ErrNotFound) {
		created = true
		thread, err = s.welcomeThread(user)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not save thread")
			return
		}
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load thread")
		return
	}
	message := domain.ThreadMessage{
		ID:          fmt.Sprintf("%s-%d", thread.ID, len(thread.Messages)+1),
		From:        "customer",
		Author:      user.Name,
		Text:        body.Text,
		At:          time.Now().Format("Today, 15:04"),
		Attachments: attachments,
	}
	thread.Messages = append(thread.Messages, message)
	thread.Status = domain.ThreadNeedsReply
	thread.Unread++
	thread.CustomerUnread = 0
	thread.LastActive = "just now"
	if err := s.Store.SaveThread(thread); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save thread")
		return
	}
	s.hub.notifyMessage(thread.ID)
	if created {
		s.hub.notifyThreads()
	}
	// Staff may not have the console open, so push the message alongside the
	// unread badge.
	s.pushToRole(push.RoleAdmin,
		"New message from "+user.Name,
		chatPreview(body.Text, len(attachments)),
		"/admin/messages/"+thread.ID,
		"fayfort-chat",
		true)
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "thread": thread})
}

func (s *Server) handlePortalProfile(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	customers, err := s.Store.AllCustomers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile")
		return
	}
	profile := map[string]any{
		"id": user.ID, "name": user.Name, "email": user.Email, "role": user.Role,
		"avatarUrl": user.AvatarURL,
	}
	for _, c := range customers {
		if c.Name == user.Name || c.Email == user.Email || user.Email == "demo@example.com" {
			profile["city"] = c.City
			profile["company"] = c.Company
			profile["currency"] = c.Currency
			profile["joined"] = c.Joined
			profile["customerId"] = c.ID
			break
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"profile": profile})
}

func (s *Server) handlePortalOverview(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	requests, err := s.Store.AllRequests()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load requests")
		return
	}
	items, err := s.Store.AllCustomerNotifications()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load notifications")
		return
	}
	active, quoteReady, total := 0, 0, 0
	for _, req := range requests {
		if req.Customer != user.Name {
			continue
		}
		total++
		switch req.Status {
		// Submitted counts as active, matching the admin KPI definition: a
		// freshly filed request is open work, not a closed one.
		case domain.RequestSubmitted, domain.RequestUnderReview, domain.RequestSupplierSearch,
			domain.RequestQuoteReady, domain.RequestCustomerAppr, domain.RequestInProgress:
			active++
		}
		if req.Status == domain.RequestQuoteReady {
			quoteReady++
		}
	}
	unread := 0
	for _, n := range items {
		if !n.Read {
			unread++
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"summary": map[string]any{
			"activeRequests": active, "quotesReady": quoteReady, "totalRequests": total, "unreadNotifications": unread,
		},
	})
}

// handlePortalThreadUnread answers the customer's waiting staff-reply count
// for the sidebar badge. No thread is created here on a missing account — the
// badge simply reads zero until the customer messages.
func (s *Server) handlePortalThreadUnread(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	thread, err := s.portalThreadFor(user)
	if errors.Is(err, store.ErrNotFound) {
		writeJSON(w, http.StatusOK, map[string]any{"unread": 0})
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load thread")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"unread": thread.CustomerUnread})
}

// handlePortalThreadRead clears the customer's unread counter when they open
// the chat, mirroring the staff side's mark-read flow.
func (s *Server) handlePortalThreadRead(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	thread, err := s.portalThreadFor(user)
	if errors.Is(err, store.ErrNotFound) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load thread")
		return
	}
	if thread.CustomerUnread != 0 {
		thread.CustomerUnread = 0
		if err := s.Store.SaveThread(thread); err != nil {
			writeError(w, http.StatusInternalServerError, "could not update thread")
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
