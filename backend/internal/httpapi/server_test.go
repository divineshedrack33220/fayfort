package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"fayfort/backend/internal/auth"
	"fayfort/backend/internal/domain"
	"fayfort/backend/internal/store"
)

func newTestServer(t *testing.T) (*Server, *store.DB, string) {
	t.Helper()
	db, err := store.Open(":memory:")
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	if err := db.SeedDemo(); err != nil {
		t.Fatalf("seed: %v", err)
	}
	adminHash, err := auth.HashPassword("admin123")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if err := db.CreateUser(store.UserRow{
		ID: "USR-ADM-001", Name: "Ada Okafor", Email: "admin@fayfort.com",
		PasswordHash: adminHash, Role: "admin", Status: "ACTIVE",
	}); err != nil {
		t.Fatalf("admin user: %v", err)
	}
	customerHash, err := auth.HashPassword("demo1234")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if err := db.CreateUser(store.UserRow{
		ID: "USR-CUS-001", Name: "David Green", Email: "demo@example.com",
		PasswordHash: customerHash, Role: "customer", Status: "ACTIVE",
	}); err != nil {
		t.Fatalf("customer user: %v", err)
	}
	discard := log.New(io.Discard, "", 0)
	return New(db, discard, "", ""), db, ""
}

func doJSON(t *testing.T, handler http.Handler, method, path string, body any, token string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		reader = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	var payload map[string]any
	if rec.Body.Len() > 0 {
		_ = json.Unmarshal(rec.Body.Bytes(), &payload)
	}
	return rec, payload
}

func login(t *testing.T, handler http.Handler, email, password string) string {
	t.Helper()
	rec, payload := doJSON(t, handler, http.MethodPost, "/api/auth/login",
		map[string]string{"email": email, "password": password}, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("login %s -> %d: %s", email, rec.Code, rec.Body.String())
	}
	token, _ := payload["token"].(string)
	if token == "" {
		t.Fatal("login returned no token")
	}
	return token
}

func TestAuthFlow(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()

	token := login(t, handler, "admin@fayfort.com", "admin123")

	rec, payload := doJSON(t, handler, http.MethodGet, "/api/me", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("me -> %d", rec.Code)
	}
	user, _ := payload["user"].(map[string]any)
	if user["email"] != "admin@fayfort.com" {
		t.Fatalf("me user = %v", user)
	}

	// Customer cannot reach admin endpoints.
	customerToken := login(t, handler, "demo@example.com", "demo1234")
	rec, _ = doJSON(t, handler, http.MethodGet, "/api/admin/dashboard", nil, customerToken)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("customer on admin dashboard -> %d, want 403", rec.Code)
	}

	// Logout revokes the session.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/auth/logout", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("logout -> %d", rec.Code)
	}
	rec, _ = doJSON(t, handler, http.MethodGet, "/api/me", nil, token)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("me after logout -> %d, want 401", rec.Code)
	}

	// Registration contract: password rule enforced.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/auth/register",
		map[string]string{"name": "Tina", "email": "tina@example.com", "password": "short"}, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("weak password register -> %d, want 400", rec.Code)
	}
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/auth/register",
		map[string]string{"name": "Tina", "email": "tina@example.com", "password": "longenough"}, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("register -> %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAdminReads(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()
	token := login(t, handler, "admin@fayfort.com", "admin123")

	paths := []struct {
		path, key  string
		wantLength int
	}{
		{"/api/admin/dashboard", "kpis", 4},
		{"/api/admin/requests", "requests", 7},
		{"/api/admin/quotes", "quotes", 7},
		{"/api/admin/orders", "orders", 7},
		{"/api/admin/shipments", "shipments", 7},
		{"/api/admin/inspections", "inspections", 7},
		{"/api/admin/customers", "customers", 6},
		{"/api/admin/suppliers", "suppliers", 6},
		{"/api/admin/messages", "threads", 5},
		{"/api/admin/notifications", "notifications", 7},
	}
	for _, tc := range paths {
		rec, payload := doJSON(t, handler, http.MethodGet, tc.path, nil, token)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s -> %d: %s", tc.path, rec.Code, rec.Body.String())
		}
		items, _ := payload[tc.key].([]any)
		if len(items) != tc.wantLength {
			t.Errorf("%s: %s has %d entries, want %d", tc.path, tc.key, len(items), tc.wantLength)
		}
	}
}

func TestQuoteIssuance(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	token := login(t, handler, "admin@fayfort.com", "admin123")

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/admin/requests/REQ-1047/quote",
		map[string]any{"supplier": "Shenzhen AmpCore Electronics", "valueUsd": 9400, "marginBps": 420,
			"imageUrls": []string{
				"https://res.cloudinary.com/hhxyvrjp/image/upload/v1/headphones.jpg",
				"https://res.cloudinary.com/hhxyvrjp/image/upload/v1/headphones-detail.jpg",
				"https://res.cloudinary.com/hhxyvrjp/image/upload/v1/headphones-box.jpg",
			}}, token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("issue quote -> %d: %s", rec.Code, rec.Body.String())
	}

	quotes, err := db.AllQuotes()
	if err != nil {
		t.Fatal(err)
	}
	if len(quotes) != 8 {
		t.Fatalf("quote count = %d, want 8", len(quotes))
	}
	last := quotes[len(quotes)-1]
	if last.RequestID != "REQ-1047" || last.Status != "SENT" {
		t.Fatalf("issued quote = %+v", last)
	}
	if last.Supplier == "" {
		t.Error("expected a supplier on the issued quote")
	}
	wantImages := []string{
		"https://res.cloudinary.com/hhxyvrjp/image/upload/v1/headphones.jpg",
		"https://res.cloudinary.com/hhxyvrjp/image/upload/v1/headphones-detail.jpg",
		"https://res.cloudinary.com/hhxyvrjp/image/upload/v1/headphones-box.jpg",
	}
	if len(last.ImageURLs) != 3 || last.ImageURLs[0] != wantImages[0] || last.ImageURLs[2] != wantImages[2] {
		t.Errorf("quote imageUrls = %v, want %v", last.ImageURLs, wantImages)
	}

	// Request detail should surface the issued quote (with its images).
	detailRec, detail := doJSON(t, handler, http.MethodGet, "/api/admin/requests/REQ-1047", nil, token)
	if detailRec.Code != http.StatusOK {
		t.Fatalf("request detail -> %d: %s", detailRec.Code, detailRec.Body.String())
	}
	requestPayload, _ := detail["request"].(map[string]any)
	if quote, ok := requestPayload["quote"].(map[string]any); ok {
		got, _ := quote["imageUrls"].([]any)
		if len(got) != 3 || got[0] != wantImages[0] {
			t.Errorf("request detail quote imageUrls = %v, want %v", got, wantImages)
		}
	} else {
		t.Error("request detail did not include the issued quote")
	}

	// Request should be nudged to QUOTE_READY.
	updated, err := db.RequestByID("REQ-1047")
	if err != nil {
		t.Fatal(err)
	}
	if updated.Status != "QUOTE_READY" {
		t.Errorf("request status = %s, want QUOTE_READY", updated.Status)
	}
}

func TestRequestStatusUpdate(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	token := login(t, handler, "admin@fayfort.com", "admin123")

	rec, _ := doJSON(t, handler, http.MethodPatch, "/api/admin/requests/REQ-1009/status",
		map[string]string{"status": "UNDER_REVIEW"}, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status update -> %d: %s", rec.Code, rec.Body.String())
	}
	row, err := db.RequestByID("REQ-1009")
	if err != nil {
		t.Fatal(err)
	}
	if row.Status != "UNDER_REVIEW" {
		t.Errorf("status = %s, want UNDER_REVIEW", row.Status)
	}

	rec, _ = doJSON(t, handler, http.MethodPatch, "/api/admin/requests/REQ-1009/status",
		map[string]string{"status": "NOT_A_STATUS"}, token)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("bad status -> %d, want 400", rec.Code)
	}
}

func TestPortalFlow(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	token := login(t, handler, "demo@example.com", "demo1234")

	rec, payload := doJSON(t, handler, http.MethodGet, "/api/portal/requests", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("portal requests -> %d", rec.Code)
	}
	items, _ := payload["requests"].([]any)
	if len(items) == 0 {
		t.Fatal("expected portal requests for David Green")
	}

	rec, payload = doJSON(t, handler, http.MethodGet, "/api/portal/notifications", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("portal notifications -> %d", rec.Code)
	}
	if unread := payload["unread"]; unread != float64(2) {
		t.Errorf("unread = %v, want 2", unread)
	}

	rec, _ = doJSON(t, handler, http.MethodGet, "/api/portal/thread", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("portal thread -> %d", rec.Code)
	}

	rec, _ = doJSON(t, handler, http.MethodPost, "/api/portal/thread",
		map[string]string{"text": "Can you price 200 units as a pilot?"}, token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("portal thread post -> %d: %s", rec.Code, rec.Body.String())
	}
	threads, err := db.AllThreads()
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, th := range threads {
		if th.Customer == "David Green" && len(th.Messages) >= 4 {
			found = true
		}
	}
	if !found {
		t.Error("expected the new customer message appended to a David Green thread")
	}

	rec, _ = doJSON(t, handler, http.MethodGet, "/api/portal/overview", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("portal overview -> %d", rec.Code)
	}
}

// A brand-new customer has nothing but SUBMITTED requests. Those are open work,
// so the dashboard must report them as active rather than showing zero.
func TestPortalOverviewCountsSubmittedRequestsAsActive(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/auth/register",
		map[string]string{"name": "Bola Adeyemi", "email": "bola@example.com", "password": "secret123"}, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("register -> %d: %s", rec.Code, rec.Body.String())
	}
	token := login(t, handler, "bola@example.com", "secret123")

	rec, _ = doJSON(t, handler, http.MethodPost, "/api/sourcing-requests",
		map[string]any{"product": "Desk Lamp", "quantity": 40, "budget": 500000,
			"currency": "NGN", "contactPhone": "+234 802 000 0000", "imageUrls": []string{}}, token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create request -> %d: %s", rec.Code, rec.Body.String())
	}

	rec, payload := doJSON(t, handler, http.MethodGet, "/api/portal/overview", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("portal overview -> %d", rec.Code)
	}
	summary, _ := payload["summary"].(map[string]any)
	if got := summary["activeRequests"]; got != float64(1) {
		t.Errorf("activeRequests = %v, want 1 for a single submitted request", got)
	}
	if got := summary["totalRequests"]; got != float64(1) {
		t.Errorf("totalRequests = %v, want 1", got)
	}
}

func TestQuoteWorkflow(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	token := login(t, handler, "demo@example.com", "demo1234")

	rec, payload := doJSON(t, handler, http.MethodGet, "/api/portal/quotes", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("portal quotes -> %d", rec.Code)
	}
	items, _ := payload["quotes"].([]any)
	if len(items) == 0 {
		t.Fatal("expected seeded quotes for David Green")
	}
	found, pendingID := false, ""
	for _, raw := range items {
		q, _ := raw.(map[string]any)
		if q["requestId"] == "REQ-1047" {
			found = true
			if q["status"] == "PENDING" {
				pendingID = "REQ-1047"
			}
		}
	}
	if !found {
		t.Error("expected the Wireless Headphones quote for David Green")
	}
	if pendingID == "" {
		t.Fatal("expected REQ-1047 to carry a pending quote to act on")
	}

	rec, _ = doJSON(t, handler, http.MethodPost,
		"/api/portal/quotes/REQ-1046/decision",
		map[string]string{"decision": "APPROVED", "reason": ""}, token)
	if rec.Code != http.StatusNotFound {
		t.Errorf("decision on foreign/unowned request -> %d, want 404", rec.Code)
	}

	rec, _ = doJSON(t, handler, http.MethodPost,
		"/api/portal/quotes/REQ-1047/decision",
		map[string]string{"decision": "MAYBE"}, token)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("invalid decision -> %d, want 400", rec.Code)
	}

	rec, payload = doJSON(t, handler, http.MethodPost,
		"/api/portal/quotes/REQ-1047/decision",
		map[string]string{"decision": "APPROVED"}, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("approve -> %d: %s", rec.Code, rec.Body.String())
	}
	updated, _ := payload["quote"].(map[string]any)
	if updated["status"] != "APPROVED" || updated["decidedAt"] == "" {
		t.Errorf("quote decision not persisted: %v", payload["quote"])
	}
	if _, ok := updated["quantity"].(float64); !ok {
		t.Errorf("decision payload must carry the request quantity: %v", payload["quote"])
	}
	qty, _ := updated["quantity"].(float64)
	if qty < 1 {
		t.Errorf("decision payload quantity = %v, want >= 1", updated["quantity"])
	}

	req, err := db.RequestByID("REQ-1047")
	if err != nil {
		t.Fatal(err)
	}
	if req.Status != "APPROVED" {
		t.Errorf("request status after approval = %s, want APPROVED", req.Status)
	}

	order, _ := payload["order"].(map[string]any)
	if order["status"] != "PAYMENT" {
		t.Errorf("approval did not auto-open an order at PAYMENT: %v", payload["order"])
	}
	if order["requestId"] != "REQ-1047" {
		t.Errorf("auto-opened order requestId = %v, want REQ-1047", order["requestId"])
	}
	orderID, _ := order["id"].(string)
	if _, err := db.OrderByID(orderID); err != nil {
		t.Errorf("auto-opened order %q not persisted: %v", orderID, err)
	}

	rec, _ = doJSON(t, handler, http.MethodPost,
		"/api/portal/quotes/REQ-1047/decision",
		map[string]string{"decision": "DECLINED"}, token)
	if rec.Code != http.StatusConflict {
		t.Errorf("second decision -> %d, want 409", rec.Code)
	}

	rec, _ = doJSON(t, handler, http.MethodPost,
		"/api/portal/quotes/REQ-1030/decision",
		map[string]string{"decision": "DECLINED"}, token)
	if rec.Code != http.StatusConflict {
		t.Errorf("deciding an already-approved quote -> %d, want 409", rec.Code)
	}

	activity, err := db.AllActivity()
	if err != nil {
		t.Fatal(err)
	}
	approved := false
	for _, a := range activity {
		if a.RequestID == "REQ-1047" && a.Action == "approved" {
			approved = true
		}
	}
	if !approved {
		t.Error("expected an 'approved' activity entry for REQ-1047")
	}
}

func TestOrderAutonomousFlow(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	token := login(t, handler, "admin@fayfort.com", "admin123")

	// ORD-1193 is seeded at PAYMENT -> confirming rolls it to PURCHASING.
	rec, payload := doJSON(t, handler, http.MethodPost, "/api/admin/orders/ORD-1193/advance", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("advance -> %d: %s", rec.Code, rec.Body.String())
	}
	if order, _ := payload["order"].(map[string]any); order["status"] != "PURCHASING" {
		t.Errorf("after confirm, stage = %v, want PURCHASING", order["status"])
	}
	stored, err := db.OrderByID("ORD-1193")
	if err != nil {
		t.Fatal(err)
	}
	if stored.Status != "PURCHASING" {
		t.Errorf("persisted stage = %s, want PURCHASING", stored.Status)
	}

	// Manual override can jump straight to any stage.
	rec, payload = doJSON(t, handler, http.MethodPut, "/api/admin/orders/ORD-1193/status",
		map[string]string{"status": "DELIVERED"}, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("set status -> %d: %s", rec.Code, rec.Body.String())
	}
	if order, _ := payload["order"].(map[string]any); order["status"] != "DELIVERED" {
		t.Errorf("override stage = %v, want DELIVERED", order["status"])
	}

	// Delivered orders cannot advance further.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/admin/orders/ORD-1193/advance", nil, token)
	if rec.Code != http.StatusConflict {
		t.Errorf("advance delivered -> %d, want 409", rec.Code)
	}

	// Unknown stages are rejected.
	rec, _ = doJSON(t, handler, http.MethodPut, "/api/admin/orders/ORD-1193/status",
		map[string]string{"status": "SOMEWHERE"}, token)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("unknown stage -> %d, want 400", rec.Code)
	}

	// Missing order -> 404.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/admin/orders/ORD-9999/advance", nil, token)
	if rec.Code != http.StatusNotFound {
		t.Errorf("advance missing order -> %d, want 404", rec.Code)
	}
}

func TestNotificationsFlow(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()
	cust := login(t, handler, "demo@example.com", "demo1234")
	admin := login(t, handler, "admin@fayfort.com", "admin123")

	// Filing a request fires both an admin and a customer notification.
	rec, payload := doJSON(t, handler, http.MethodPost, "/api/sourcing-requests",
		map[string]any{"product": "Notif Test Widget", "quantity": 100, "budget": 900000,
			"currency": "NGN", "contactPhone": "+234 800 000 0000"}, cust)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create request -> %d: %s", rec.Code, rec.Body.String())
	}
	reqID, _ := payload["request"].(map[string]any)["id"].(string)
	if reqID == "" {
		t.Fatal("expected a request id")
	}

	rec, payload = doJSON(t, handler, http.MethodGet, "/api/admin/notifications", nil, admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("admin notifications -> %d", rec.Code)
	}
	foundRequest := false
	for _, raw := range payload["notifications"].([]any) {
		n, _ := raw.(map[string]any)
		if n["kind"] == "request" && n["href"] == "/admin/requests/"+reqID {
			foundRequest = true
		}
	}
	if !foundRequest {
		t.Error("expected an admin 'new request' notification for " + reqID)
	}

	rec, payload = doJSON(t, handler, http.MethodGet, "/api/portal/notifications", nil, cust)
	if rec.Code != http.StatusOK {
		t.Fatalf("portal notifications -> %d", rec.Code)
	}
	var custID string
	foundReceived := false
	for _, raw := range payload["notifications"].([]any) {
		n, _ := raw.(map[string]any)
		if n["requestId"] == reqID && strings.Contains(n["title"].(string), "received") {
			foundReceived = true
			custID, _ = n["id"].(string)
		}
	}
	if !foundReceived || custID == "" {
		t.Error("expected a 'received' customer notification for " + reqID)
	}

	// Issuing a quote notifies the customer that it is ready.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/admin/requests/"+reqID+"/quote",
		map[string]any{"supplier": "Test Supplier Co.", "valueUsd": 9000, "marginBps": 300}, admin)
	if rec.Code != http.StatusCreated {
		t.Fatalf("issue quote -> %d: %s", rec.Code, rec.Body.String())
	}
	rec, payload = doJSON(t, handler, http.MethodGet, "/api/portal/notifications", nil, cust)
	quoteReady := false
	for _, raw := range payload["notifications"].([]any) {
		n, _ := raw.(map[string]any)
		if n["requestId"] == reqID && n["title"] == "Notif Test Widget — quote ready" {
			quoteReady = true
		}
	}
	if !quoteReady {
		t.Error("expected a 'quote ready' customer notification for " + reqID)
	}

	// Accepting the quote notifies the admin.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/portal/quotes/"+reqID+"/decision",
		map[string]string{"decision": "APPROVED"}, cust)
	if rec.Code != http.StatusOK {
		t.Fatalf("approve -> %d: %s", rec.Code, rec.Body.String())
	}
	rec, payload = doJSON(t, handler, http.MethodGet, "/api/admin/notifications", nil, admin)
	accepted := false
	for _, raw := range payload["notifications"].([]any) {
		n, _ := raw.(map[string]any)
		msg, _ := n["message"].(string)
		if n["kind"] == "quote" && strings.Contains(msg, "accepted") && strings.Contains(msg, "Notif Test Widget") {
			accepted = true
		}
	}
	if !accepted {
		t.Error("expected an admin 'accepted quote' notification")
	}

	// A single notification can be marked read.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/portal/notifications/"+custID+"/read", nil, cust)
	if rec.Code != http.StatusOK {
		t.Errorf("mark single read -> %d", rec.Code)
	}
	rec, payload = doJSON(t, handler, http.MethodGet, "/api/portal/notifications", nil, cust)
	for _, raw := range payload["notifications"].([]any) {
		n, _ := raw.(map[string]any)
		if n["id"] == custID && n["read"] != true {
			t.Errorf("notification %s not marked read: %v", custID, n["read"])
		}
	}

	// Marking everything read clears the admin badge.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/admin/notifications/read", nil, admin)
	if rec.Code != http.StatusOK {
		t.Errorf("admin mark all read -> %d", rec.Code)
	}
	rec, payload = doJSON(t, handler, http.MethodGet, "/api/admin/notifications", nil, admin)
	if payload["unread"] != float64(0) {
		t.Errorf("admin unread after mark-all = %v, want 0", payload["unread"])
	}
}

func TestMarketingAndEstimate(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/contact",
		map[string]string{"name": "Ayo", "email": "ayo@example.com", "message": "Interested in sourcing."}, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("contact -> %d: %s", rec.Code, rec.Body.String())
	}
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/contact",
		map[string]string{"name": "Ayo", "message": "missing email"}, "")
	if rec.Code != http.StatusBadRequest {
		t.Errorf("bad contact -> %d, want 400", rec.Code)
	}

	rec, payload := doJSON(t, handler, http.MethodPost, "/api/sourcing-requests",
		map[string]any{"product": "Bluetooth Speakers", "quantity": 250, "budget": 1200000,
			"currency": "NGN", "contactPhone": "+234 701 000 0000", "imageUrls": []string{
				"https://res.cloudinary.com/hhxyvrjp/image/upload/v1/speaker.png",
				"https://res.cloudinary.com/hhxyvrjp/image/upload/v1/speaker-2.png",
			}}, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("create request -> %d: %s", rec.Code, rec.Body.String())
	}
	if created, ok := payload["request"].(map[string]any); ok {
		urls, _ := created["imageUrls"].([]any)
		if len(urls) != 2 || urls[0] != "https://res.cloudinary.com/hhxyvrjp/image/upload/v1/speaker.png" {
			t.Errorf("create request did not persist imageUrls: %v", created["imageUrls"])
		}
		if created["contactPhone"] != "+234 701 000 0000" {
			t.Errorf("create request did not persist contactPhone: %v", created["contactPhone"])
		}
	}

	// A request without a contact number is rejected.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/sourcing-requests",
		map[string]any{"product": "No Number Gadget", "quantity": 10, "budget": 100000,
			"currency": "NGN"}, "")
	if rec.Code != http.StatusBadRequest {
		t.Errorf("request without contactPhone -> %d, want 400", rec.Code)
	}

	// A signed-in customer's request is attributed to their account.
	customerToken := login(t, handler, "demo@example.com", "demo1234")
	rec, payload = doJSON(t, handler, http.MethodPost, "/api/sourcing-requests",
		map[string]any{"product": "Camping Tents", "quantity": 120, "budget": 2000000,
			"currency": "NGN", "contactPhone": "+233 24 000 0000", "imageUrls": []string{
				"https://res.cloudinary.com/hhxyvrjp/image/upload/v1/tent.png",
				"https://res.cloudinary.com/hhxyvrjp/image/upload/v1/tent-2.png",
			}},
		customerToken)
	if rec.Code != http.StatusCreated {
		t.Fatalf("signed-in create request -> %d: %s", rec.Code, rec.Body.String())
	}
	if created, ok := payload["request"].(map[string]any); !ok || created["customer"] != "David Green" {
		t.Errorf("signed-in request was not attributed to the customer: %v", created)
	}

	rec, payload = doJSON(t, handler, http.MethodPost, "/api/estimate/check",
		map[string]any{"unitCostUsd": 10, "quantity": 1000, "shipmentWeightKg": 500,
			"shipmentVolumeCbm": 10, "transportMode": "lcl", "doorDelivery": true,
			"dutyRate": 0.12, "inspectionIncluded": true}, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("estimate -> %d", rec.Code)
	}
	result, ok := payload["result"].(map[string]any)
	if !ok {
		t.Fatal("expected an estimate result")
	}
	if lines, ok := result["lines"].([]any); !ok || len(lines) == 0 {
		t.Fatal("expected cost lines in the estimate")
	}
}

func TestDashboardDerivesLiveData(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()

	rec, _ := doJSON(t, handler, http.MethodPost, "/api/sourcing-requests",
		map[string]any{"product": "Solar Inverters", "quantity": 10, "budget": 500000,
			"currency": "NGN", "contactPhone": "+234 800 111 2222"}, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("create request -> %d", rec.Code)
	}

	adminToken := login(t, handler, "admin@fayfort.com", "admin123")
	rec, payload := doJSON(t, handler, http.MethodGet, "/api/admin/dashboard", nil, adminToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("dashboard -> %d: %s", rec.Code, rec.Body.String())
	}

	top, ok := payload["topRequestedProducts"].([]any)
	if !ok {
		t.Fatal("expected topRequestedProducts in dashboard")
	}
	found := false
	for _, entry := range top {
		m, _ := entry.(map[string]any)
		if m["product"] == "Solar Inverters" {
			found = true
		}
	}
	if !found {
		t.Error("topRequestedProducts should include the live request the admin just filed")
	}

	kpis, ok := payload["kpis"].([]any)
	if !ok || len(kpis) < 2 {
		t.Fatalf("expected kpis, got %#v", kpis)
	}
	if active := kpis[1].(map[string]any)["value"]; active == "0" {
		t.Error("active requests KPI should reflect live requests, not demo constants")
	}
}

func TestTypingOverWebSocket(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()
	ts := httptest.NewServer(handler)
	defer ts.Close()

	customerToken := login(t, handler, "demo@example.com", "demo1234")
	adminToken := login(t, handler, "admin@fayfort.com", "admin123")

	dial := func(token string) *websocket.Conn {
		t.Helper()
		wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/api/ws"
		header := http.Header{"Authorization": []string{"Bearer " + token}}
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
		if err != nil {
			t.Fatalf("dial: %v", err)
		}
		t.Cleanup(func() { _ = conn.Close() })
		return conn
	}

	cust := dial(customerToken)
	admin := dial(adminToken)

	subscribe := func(conn *websocket.Conn) {
		t.Helper()
		if err := conn.WriteJSON(wsMessage{Type: "subscribe", ThreadID: "TH-0001"}); err != nil {
			t.Fatalf("subscribe: %v", err)
		}
	}
	subscribe(cust)
	subscribe(admin)
	waitForSubscription(t, srv.hub, "TH-0001", 2)

	// Unauthenticated dial is rejected with 401 before the upgrade.
	if denied, _, err := websocket.DefaultDialer.Dial(wsURLFor(ts), nil); err == nil {
		_ = denied.Close()
		t.Fatal("unauthenticated dial should fail")
	}

	oldTimeout := wsTypingTimeout
	wsTypingTimeout = 300 * time.Millisecond
	defer func() { wsTypingTimeout = oldTimeout }()

	// A typer never receives their own indicator: subscribe on a scratch
	// connection, type, and assert nothing arrives within a short window.
	scratch := dial(customerToken)
	if err := scratch.WriteJSON(wsMessage{Type: "subscribe", ThreadID: "TH-ECHO"}); err != nil {
		t.Fatalf("scratch subscribe: %v", err)
	}
	// Let the subscribe land, otherwise the replay path could mask the check.
	waitForSubscription(t, srv.hub, "TH-ECHO", 1)
	if err := scratch.WriteJSON(wsMessage{Type: "typing", ThreadID: "TH-ECHO"}); err != nil {
		t.Fatalf("scratch typing: %v", err)
	}
	frames := make(chan wsMessage, 1)
	go func() {
		var m wsMessage
		_ = scratch.ReadJSON(&m)
		frames <- m
	}()
	select {
	case m := <-frames:
		_ = scratch.Close()
		t.Fatalf("typer received its own echo: %+v", m)
	case <-time.After(400 * time.Millisecond):
	}
	_ = scratch.Close()

	// Customer types -> the admin sees "typing".
	if err := cust.WriteJSON(wsMessage{Type: "typing", ThreadID: "TH-0001"}); err != nil {
		t.Fatalf("customer typing: %v", err)
	}
	var got wsMessage
	if err := admin.ReadJSON(&got); err != nil {
		t.Fatalf("admin read typing: %v", err)
	}
	if got.Type != "typing" || got.ThreadID != "TH-0001" || got.From != "David Green" || got.Role != "customer" {
		t.Fatalf("admin event = %+v", got)
	}

	// Admin types -> the customer sees it (role normalized to staff).
	if err := admin.WriteJSON(wsMessage{Type: "typing", ThreadID: "TH-0001"}); err != nil {
		t.Fatalf("admin typing: %v", err)
	}
	if err := cust.ReadJSON(&got); err != nil {
		t.Fatalf("customer read typing: %v", err)
	}
	if got.Type != "typing" || got.From != "Ada Okafor" || got.Role != "staff" {
		t.Fatalf("customer event = %+v", got)
	}

	// Once the indicators expire both sides receive "stopped".
	for _, side := range []struct {
		conn *websocket.Conn
		who  string
	}{{cust, "customer"}, {admin, "admin"}} {
		_ = side.conn.SetReadDeadline(time.Now().Add(3 * time.Second))
		var ev wsMessage
		for {
			if err := side.conn.ReadJSON(&ev); err != nil {
				t.Fatalf("%s read stopped: %v", side.who, err)
			}
			if ev.Type == "stopped" {
				break
			}
		}
		_ = side.conn.SetReadDeadline(time.Time{})
		if ev.ThreadID != "TH-0001" {
			t.Fatalf("%s stopped event = %+v", side.who, ev)
		}
	}
}

func wsURLFor(ts *httptest.Server) string {
	return "ws://" + strings.TrimPrefix(ts.URL, "http://") + "/api/ws"
}

// waitForSubscription blocks until the hub has registered `want` sockets on a
// thread. Subscribe frames are handled on each connection's read loop, so
// without this barrier a following HTTP action can finish notifying before the
// socket is listening and the event is silently dropped.
func waitForSubscription(t *testing.T, hub *wsHub, threadID string, want int) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		hub.mu.Lock()
		got := len(hub.clients[threadID])
		hub.mu.Unlock()
		if got >= want {
			return
		}
		time.Sleep(2 * time.Millisecond)
	}
	t.Fatalf("no socket subscribed to %s", threadID)
}

func TestWSMessageEvents(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()
	ts := httptest.NewServer(handler)
	defer ts.Close()

	customerToken := login(t, handler, "demo@example.com", "demo1234")
	adminToken := login(t, handler, "admin@fayfort.com", "admin123")

	// Admin subscribes to David Green's seeded thread TH-002.
	dial := func(token string) *websocket.Conn {
		t.Helper()
		h := http.Header{"Authorization": []string{"Bearer " + token}}
		conn, _, err := websocket.DefaultDialer.Dial(wsURLFor(ts), h)
		if err != nil {
			t.Fatalf("dial: %v", err)
		}
		t.Cleanup(func() { _ = conn.Close() })
		return conn
	}
	admin := dial(adminToken)
	if err := admin.WriteJSON(wsMessage{Type: "subscribe", ThreadID: "TH-002"}); err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	waitForSubscription(t, srv.hub, "TH-002", 1)

	// Customer posts a message -> the admin socket wakes immediately.
	rec, _ := doJSON(t, handler, http.MethodPost, "/api/portal/thread",
		map[string]string{"text": "Where is my shipment?"}, customerToken)
	if rec.Code != http.StatusCreated {
		t.Fatalf("customer post -> %d: %s", rec.Code, rec.Body.String())
	}
	_ = admin.SetReadDeadline(time.Now().Add(2 * time.Second))
	var got wsMessage
	if err := admin.ReadJSON(&got); err != nil {
		t.Fatalf("admin read message event: %v", err)
	}
	_ = admin.SetReadDeadline(time.Time{})
	if got.Type != "message" || got.ThreadID != "TH-002" {
		t.Fatalf("message event = %+v", got)
	}
}

func TestWSTokenAuth(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()
	ts := httptest.NewServer(handler)
	defer ts.Close()

	adminToken := login(t, handler, "admin@fayfort.com", "admin123")

	rec, payload := doJSON(t, handler, http.MethodPost, "/api/ws-token", nil, adminToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("ws-token -> %d: %s", rec.Code, rec.Body.String())
	}
	oneTime := payload["token"].(string)
	if oneTime == "" {
		t.Fatal("ws-token returned no token")
	}

	// A fresh socket authenticates with the query token (browser path).
	conn, _, err := websocket.DefaultDialer.Dial(wsURLFor(ts)+"?token="+oneTime, nil)
	if err != nil {
		t.Fatalf("token dial: %v", err)
	}
	_ = conn.Close()

	// The token is single-use; a second dial with it is rejected.
	if _, _, err := websocket.DefaultDialer.Dial(wsURLFor(ts)+"?token="+oneTime, nil); err == nil {
		t.Fatal("reused token should be rejected")
	}

	// Unauthenticated socket still rejected.
	if _, _, err := websocket.DefaultDialer.Dial(wsURLFor(ts), nil); err == nil {
		t.Fatal("anonymous dial should be rejected")
	}
}

func TestWSThreadsPoke(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()
	ts := httptest.NewServer(handler)
	defer ts.Close()

	admin := login(t, handler, "admin@fayfort.com", "admin123")
	conn, _, err := websocket.DefaultDialer.Dial(wsURLFor(ts),
		http.Header{"Authorization": []string{"Bearer " + admin}})
	if err != nil {
		t.Fatalf("admin dial: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	// Admin subscribes to a thread it already knows (TH-001) so it's reachable.
	if err := conn.WriteJSON(wsMessage{Type: "subscribe", ThreadID: "TH-001"}); err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	waitForSubscription(t, srv.hub, "TH-001", 1)

	// A brand-new customer signs up and opens their chat, which creates a
	// welcome thread the admin never subscribed to.
	rec, payload := doJSON(t, handler, http.MethodPost, "/api/auth/register",
		map[string]string{"name": "Fresh Buyer", "email": "fresh@example.com", "password": "passw0rd123"},
		"")
	if rec.Code != http.StatusCreated {
		t.Fatalf("register -> %d: %s", rec.Code, rec.Body.String())
	}
	newCustToken, _ := payload["token"].(string)
	if newCustToken == "" {
		t.Fatalf("register returned no token: %v", payload)
	}

	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	rec, _ = doJSON(t, handler, http.MethodGet, "/api/portal/thread", nil, newCustToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("portal thread -> %d: %s", rec.Code, rec.Body.String())
	}
	var got wsMessage
	if err := conn.ReadJSON(&got); err != nil {
		t.Fatalf("no threads poke on welcome-thread creation: %v", err)
	}
	if got.Type != "threads" {
		t.Fatalf("expected threads poke, got %+v", got)
	}
	var stale wsMessage
	_ = conn.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	if err := conn.ReadJSON(&stale); err == nil {
		t.Fatalf("unexpected extra event %+v", stale)
	}
}

func TestThreadAttachments(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	admin := login(t, handler, "admin@fayfort.com", "admin123")
	customer := login(t, handler, "demo@example.com", "demo1234")

	// Staff reply with text + an image attachment.
	rec, payload := doJSON(t, handler, http.MethodPost, "/api/admin/messages/TH-001/reply",
		map[string]any{
			"text": "Here is the catalogue page.",
			"attachments": []map[string]any{
				{"url": "https://res.cloudinary.com/fayfort/cat.png", "kind": "image"},
				{"url": "https://res.cloudinary.com/fayfort/walk.mp4", "kind": "video"},
				{"url": "", "kind": "image"},                         // dropped
				{"url": "https://x.example/nope.pdf", "kind": "pdf"}, // dropped
			},
		}, admin)
	if rec.Code != http.StatusCreated {
		t.Fatalf("reply with attachments -> %d: %s", rec.Code, rec.Body.String())
	}
	threadData, _ := payload["thread"].(map[string]any)
	messages, _ := threadData["messages"].([]any)
	last := messages[len(messages)-1].(map[string]any)
	atts, _ := last["attachments"].([]any)
	if len(atts) != 2 {
		t.Fatalf("expected 2 cleaned attachments, got %d", len(atts))
	}

	// Attachment-only customer message is accepted.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/portal/thread",
		map[string]any{
			"attachments": []map[string]any{
				{"url": "https://res.cloudinary.com/fayfort/sample.jpg", "kind": "image"},
			},
		}, customer)
	if rec.Code != http.StatusCreated {
		t.Fatalf("portal attachment-only post -> %d: %s", rec.Code, rec.Body.String())
	}

	// Empty message (no text, no attachments) is rejected.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/portal/thread",
		map[string]any{"text": "   "}, customer)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("empty portal post -> %d, want 400", rec.Code)
	}

	threads, err := db.AllThreads()
	if err != nil {
		t.Fatal(err)
	}
	var th *domain.Thread
	for i := range threads {
		if threads[i].ID == "TH-001" {
			th = &threads[i]
			break
		}
	}
	if th == nil {
		t.Fatal("TH-001 not found")
	}
	got := th.Messages[len(th.Messages)-1]
	if len(got.Attachments) != 2 || got.Attachments[0].Kind != "image" || got.Attachments[1].Kind != "video" {
		t.Fatalf("unexpected persisted attachments: %+v", got.Attachments)
	}

	// David Green's thread (TH-002) carries the attachment-only customer message.
	for i := range threads {
		if threads[i].ID == "TH-002" {
			last := threads[i].Messages[len(threads[i].Messages)-1]
			if len(last.Attachments) != 1 || last.Attachments[0].Kind != "image" {
				t.Fatalf("unexpected customer attachments: %+v", last.Attachments)
			}
		}
	}
}

func TestThreadUnreadBadges(t *testing.T) {
	srv, db, _ := newTestServer(t)
	handler := srv.Routes()
	admin := login(t, handler, "admin@fayfort.com", "admin123")
	customer := login(t, handler, "demo@example.com", "demo1234")

	// Staff sidebar badge = sum of seeded unread threads (2 + 1 + 1).
	rec, payload := doJSON(t, handler, http.MethodGet, "/api/admin/messages/unread", nil, admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("admin messages/unread -> %d", rec.Code)
	}
	if got := payload["unread"]; got != float64(4) {
		t.Errorf("admin messages unread = %v, want 4", got)
	}

	// Customer badge starts at the seeded unread staff reply.
	rec, payload = doJSON(t, handler, http.MethodGet, "/api/portal/thread/unread", nil, customer)
	if rec.Code != http.StatusOK {
		t.Fatalf("portal thread/unread -> %d", rec.Code)
	}
	if got := payload["unread"]; got != float64(1) {
		t.Errorf("portal thread unread = %v, want 1", got)
	}

	// Opening the chat clears the customer badge.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/portal/thread/read", nil, customer)
	if rec.Code != http.StatusOK {
		t.Fatalf("portal thread/read -> %d", rec.Code)
	}
	rec, payload = doJSON(t, handler, http.MethodGet, "/api/portal/thread/unread", nil, customer)
	if got := payload["unread"]; got != float64(0) {
		t.Errorf("portal thread unread after read = %v, want 0", got)
	}

	// Staff reply bumps the customer badge again and clears the staff side.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/admin/messages/TH-002/reply",
		map[string]string{"text": "Your sneakers order is confirmed on the Pantarlih line."}, admin)
	if rec.Code != http.StatusCreated {
		t.Fatalf("staff reply -> %d: %s", rec.Code, rec.Body.String())
	}
	rec, payload = doJSON(t, handler, http.MethodGet, "/api/portal/thread/unread", nil, customer)
	if got := payload["unread"]; got != float64(1) {
		t.Errorf("portal thread unread after reply = %v, want 1", got)
	}
	rec, payload = doJSON(t, handler, http.MethodGet, "/api/admin/messages/unread", nil, admin)
	if got := payload["unread"]; got != float64(4) {
		t.Errorf("admin messages unread after reply = %v, want 4", got)
	}

	// Customer writing back clears their own badge and re-arms the staff badge.
	rec, _ = doJSON(t, handler, http.MethodPost, "/api/portal/thread",
		map[string]string{"text": "Great, thanks!"}, customer)
	if rec.Code != http.StatusCreated {
		t.Fatalf("customer post -> %d: %s", rec.Code, rec.Body.String())
	}
	rec, payload = doJSON(t, handler, http.MethodGet, "/api/portal/thread/unread", nil, customer)
	if got := payload["unread"]; got != float64(0) {
		t.Errorf("portal thread unread after customer post = %v, want 0", got)
	}
	rec, payload = doJSON(t, handler, http.MethodGet, "/api/admin/messages/unread", nil, admin)
	if got := payload["unread"]; got != float64(5) {
		t.Errorf("admin messages unread after customer post = %v, want 5", got)
	}

	// Unread badge endpoints persist the counter through the store.
	thread, err := db.ThreadByID("TH-002")
	if err != nil {
		t.Fatal(err)
	}
	if thread.CustomerUnread != 0 || thread.Unread != 1 {
		t.Errorf("TH-002 counters = customer %d / staff %d, want 0 / 1", thread.CustomerUnread, thread.Unread)
	}
}

func TestCallSignallingOverWebSocket(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()
	ts := httptest.NewServer(handler)
	defer ts.Close()

	customerToken := login(t, handler, "demo@example.com", "demo1234")
	adminToken := login(t, handler, "admin@fayfort.com", "admin123")

	dial := func(token string) *websocket.Conn {
		t.Helper()
		conn, _, err := websocket.DefaultDialer.Dial(wsURLFor(ts),
			http.Header{"Authorization": []string{"Bearer " + token}})
		if err != nil {
			t.Fatalf("dial: %v", err)
		}
		t.Cleanup(func() { _ = conn.Close() })
		return conn
	}
	read := func(t *testing.T, conn *websocket.Conn) wsMessage {
		t.Helper()
		_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
		var m wsMessage
		if err := conn.ReadJSON(&m); err != nil {
			t.Fatalf("read: %v", err)
		}
		return m
	}
	expectNothing := func(t *testing.T, conn *websocket.Conn) {
		t.Helper()
		_ = conn.SetReadDeadline(time.Now().Add(300 * time.Millisecond))
		var m wsMessage
		if err := conn.ReadJSON(&m); err == nil {
			t.Fatalf("unexpected frame %+v", m)
		}
	}

	cust := dial(customerToken)
	admin := dial(adminToken)
	for _, conn := range []*websocket.Conn{cust, admin} {
		if err := conn.WriteJSON(wsMessage{Type: "subscribe", ThreadID: "TH-0001"}); err != nil {
			t.Fatalf("subscribe: %v", err)
		}
	}
	waitForSubscription(t, srv.hub, "TH-0001", 2)

	// Customer rings the staff member: the admin learns who is calling, in
	// which role, with which media — all stamped by the hub, not the client.
	if err := cust.WriteJSON(wsMessage{
		Type: "call:invite", ThreadID: "TH-0001", CallID: "call-1", Mode: "video", From: "Someone Else", Role: "staff",
	}); err != nil {
		t.Fatalf("invite: %v", err)
	}
	got := read(t, admin)
	if got.Type != "call:invite" || got.CallID != "call-1" || got.Mode != "video" {
		t.Fatalf("invite relayed wrong: %+v", got)
	}
	if got.From != "David Green" || got.Role != "customer" {
		t.Fatalf("hub must stamp the authenticated sender, got %+v", got)
	}
	// A caller never hears its own ring. Checked on a scratch socket (a read
	// timeout leaves a gorilla connection unusable for later reads) and a
	// scratch thread so it cannot supersede the live invite.
	scratch := dial(customerToken)
	if err := scratch.WriteJSON(wsMessage{Type: "subscribe", ThreadID: "TH-ECHO"}); err != nil {
		t.Fatalf("scratch subscribe: %v", err)
	}
	waitForSubscription(t, srv.hub, "TH-ECHO", 1)
	if err := scratch.WriteJSON(wsMessage{Type: "call:invite", ThreadID: "TH-ECHO", CallID: "call-echo", Mode: "audio"}); err != nil {
		t.Fatalf("scratch invite: %v", err)
	}
	expectNothing(t, scratch)
	_ = scratch.Close()

	// A late subscriber on the other side still gets the ring (they opened the
	// thread after the call was placed). The caller never does, so this uses a
	// second staff socket rather than a second customer one.
	late := dial(adminToken)
	if err := late.WriteJSON(wsMessage{Type: "subscribe", ThreadID: "TH-0001"}); err != nil {
		t.Fatalf("late subscribe: %v", err)
	}
	replay := read(t, late)
	if replay.Type != "call:invite" || replay.CallID != "call-1" || replay.From != "David Green" {
		t.Fatalf("ring not replayed to a late subscriber: %+v", replay)
	}
	_ = late.Close()

	// A second tab of the same user closing must not cancel a call placed
	// from their other tab.
	otherTab := dial(customerToken)
	if err := otherTab.WriteJSON(wsMessage{Type: "subscribe", ThreadID: "TH-0001"}); err != nil {
		t.Fatalf("other tab subscribe: %v", err)
	}
	waitForSubscription(t, srv.hub, "TH-0001", 3)
	_ = otherTab.Close()
	time.Sleep(50 * time.Millisecond)
	srv.hub.mu.Lock()
	_, stillRinging := srv.hub.calls["TH-0001"]
	srv.hub.mu.Unlock()
	if !stillRinging {
		t.Fatal("closing another tab should not cancel the caller's ring")
	}

	// Accept travels back to the caller and clears the pending ring.
	if err := admin.WriteJSON(wsMessage{Type: "call:accept", ThreadID: "TH-0001", CallID: "call-1"}); err != nil {
		t.Fatalf("accept: %v", err)
	}
	accept := read(t, cust)
	if accept.Type != "call:accept" || accept.CallID != "call-1" || accept.Role != "staff" {
		t.Fatalf("accept relayed wrong: %+v", accept)
	}
	srv.hub.mu.Lock()
	_, ringAfterAccept := srv.hub.calls["TH-0001"]
	srv.hub.mu.Unlock()
	if ringAfterAccept {
		t.Fatal("accept should clear the pending invite")
	}

	// Malformed frames are dropped rather than relayed.
	if err := cust.WriteJSON(wsMessage{Type: "call:invite", ThreadID: "TH-0001", CallID: "call-2", Mode: "hologram"}); err != nil {
		t.Fatalf("bad mode invite: %v", err)
	}
	if err := cust.WriteJSON(wsMessage{Type: "call:invite", ThreadID: "TH-0001", CallID: strings.Repeat("x", 200), Mode: "audio"}); err != nil {
		t.Fatalf("long id invite: %v", err)
	}
	if err := cust.WriteJSON(wsMessage{Type: "call:invite", ThreadID: "TH-0001", Mode: "audio"}); err != nil {
		t.Fatalf("idless invite: %v", err)
	}
	expectNothing(t, admin)
}

func TestCallRingExpiresAndClearsForBothSides(t *testing.T) {
	srv, _, _ := newTestServer(t)
	handler := srv.Routes()
	ts := httptest.NewServer(handler)
	defer ts.Close()

	old := wsCallInviteTTL
	wsCallInviteTTL = 300 * time.Millisecond
	defer func() { wsCallInviteTTL = old }()

	customerToken := login(t, handler, "demo@example.com", "demo1234")
	adminToken := login(t, handler, "admin@fayfort.com", "admin123")

	dial := func(token string) *websocket.Conn {
		t.Helper()
		conn, _, err := websocket.DefaultDialer.Dial(wsURLFor(ts),
			http.Header{"Authorization": []string{"Bearer " + token}})
		if err != nil {
			t.Fatalf("dial: %v", err)
		}
		t.Cleanup(func() { _ = conn.Close() })
		return conn
	}
	cust := dial(customerToken)
	admin := dial(adminToken)
	for _, conn := range []*websocket.Conn{cust, admin} {
		if err := conn.WriteJSON(wsMessage{Type: "subscribe", ThreadID: "TH-0001"}); err != nil {
			t.Fatalf("subscribe: %v", err)
		}
	}
	waitForSubscription(t, srv.hub, "TH-0001", 2)

	if err := cust.WriteJSON(wsMessage{Type: "call:invite", ThreadID: "TH-0001", CallID: "call-x", Mode: "audio"}); err != nil {
		t.Fatalf("invite: %v", err)
	}
	_ = admin.SetReadDeadline(time.Now().Add(3 * time.Second))
	var invite wsMessage
	if err := admin.ReadJSON(&invite); err != nil || invite.Type != "call:invite" {
		t.Fatalf("no ring delivered: %+v %v", invite, err)
	}

	// Nobody answers, so the hub closes the ring for the invitee.
	_ = admin.SetReadDeadline(time.Now().Add(3 * time.Second))
	var cancel wsMessage
	if err := admin.ReadJSON(&cancel); err != nil {
		t.Fatalf("no timeout cancel: %v", err)
	}
	if cancel.Type != "call:cancel" || cancel.CallID != "call-x" || cancel.Reason != "timeout" {
		t.Fatalf("timeout cancel wrong: %+v", cancel)
	}
	srv.hub.mu.Lock()
	_, stillRinging := srv.hub.calls["TH-0001"]
	srv.hub.mu.Unlock()
	if stillRinging {
		t.Fatal("expired ring should be dropped from the hub")
	}
}

func TestWSOriginAllowed(t *testing.T) {
	cases := []struct {
		name   string
		origin string
		env    string
		want   bool
	}{
		{"no origin", "", "", true},
		{"localhost", "http://localhost:3100", "", true},
		{"loopback", "https://127.0.0.1:3100", "", true},
		{"ipv6 loopback", "http://[::1]:3100", "", true},
		{"deployed frontend allowed by default", "https://fayfort-web.onrender.com", "", true},
		{"web origin allowed via env too", "https://fayfort-web.onrender.com", "https://fayfort-web.onrender.com", true},
		{"host match via env", "https://fayfort-web.onrender.com", "fayfort-web.onrender.com", true},
		{"third-party origin still denied", "https://evil.example.com", "https://fayfort-web.onrender.com", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv(EnvWSAllowedOrigins, tc.env)
			r := httptest.NewRequest(http.MethodGet, "/api/ws", nil)
			if tc.origin != "" {
				r.Header.Set("Origin", tc.origin)
			}
			if got := wsOriginAllowed(r); got != tc.want {
				t.Fatalf("wsOriginAllowed(origin=%q, env=%q) = %v, want %v", tc.origin, tc.env, got, tc.want)
			}
		})
	}
}
