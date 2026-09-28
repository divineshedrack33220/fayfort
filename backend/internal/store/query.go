package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"fayfort/backend/internal/domain"
)

const colCustomers = `id, name, email, company, city, currency, requests, pipeline_value, joined, status`
const colSuppliers = `id, name, city, country, category, reliability, lead_days, moq, contact_email, contact_phone, payment_terms, products_json, notes, requests, since, status`
const colShipments = `id, request_id, product, customer, supplier, carrier, mode, origin, destination, container_ref, departed_at, eta, delivered_at, status`
const colThreads = `id, customer, email, subject, ref, unread, customer_unread, status, last_active, messages`
const colQuotes = `id, request_id, product, customer, supplier, value_usd, margin_bps, status, issued_at, expires_at, image_urls, decided_at, decision_reason`
const colActivity = `id, actor, action, target, request_id, at, tone`
const colRequests = `id, product, category, customer, city, quantity, budget, currency, status, date, submitted_by, supplier_hint, destination, notes_body, contact_phone, image_urls`
const colAdminNotifs = `id, kind, message, time, read, href`
const colCustomerNotifs = `id, title, body, at, read, request_id`
const colOrders = `id, request_id, customer, product, supplier, quantity, unit_price_usd, value_usd, status, date, eta`
const colInspections = `id, order_id, customer, supplier, product, quantity, status, scheduled_at, inspector, notes`

// ---- customers

func (db *DB) AllCustomers() ([]domain.Customer, error) {
	rows, err := db.Query(`SELECT ` + colCustomers + ` FROM customers ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Customer, 0)
	for rows.Next() {
		var c domain.Customer
		if err := rows.Scan(&c.ID, &c.Name, &c.Email, &c.Company, &c.City, &c.Currency,
			&c.Requests, &c.PipelineValue, &c.Joined, (*string)(&c.Status)); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// ---- suppliers

func (db *DB) AllSuppliers() ([]domain.Supplier, error) {
	rows, err := db.Query(`SELECT ` + colSuppliers + ` FROM suppliers ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Supplier, 0)
	for rows.Next() {
		var s domain.Supplier
		var productsJSON string
		if err := rows.Scan(&s.ID, &s.Name, &s.City, &s.Country, &s.Category, &s.Reliability,
			&s.LeadDays, &s.MOQ, &s.ContactEmail, &s.ContactPhone, &s.PaymentTerms,
			&productsJSON, &s.Notes, &s.Requests, &s.Since, (*string)(&s.Status)); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(productsJSON), &s.Products)
		out = append(out, s)
	}
	return out, rows.Err()
}

// ---- shipments

func (db *DB) AllShipments() ([]domain.Shipment, error) {
	rows, err := db.Query(`SELECT ` + colShipments + ` FROM shipments ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Shipment, 0)
	for rows.Next() {
		var s domain.Shipment
		if err := rows.Scan(&s.ID, &s.RequestID, &s.Product, &s.Customer, &s.Supplier, &s.Carrier,
			&s.Mode, &s.Origin, &s.Destination, &s.ContainerRef, &s.DepartedAt, &s.ETA,
			&s.DeliveredAt, (*string)(&s.Status)); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// ---- threads

func (db *DB) AllThreads() ([]domain.Thread, error) {
	rows, err := db.Query(`SELECT ` + colThreads + ` FROM threads ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Thread, 0)
	for rows.Next() {
		var t domain.Thread
		var messagesJSON string
		if err := rows.Scan(&t.ID, &t.Customer, &t.Email, &t.Subject, &t.Ref, &t.Unread,
			&t.CustomerUnread, (*string)(&t.Status), &t.LastActive, &messagesJSON); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(messagesJSON), &t.Messages)
		out = append(out, t)
	}
	return out, rows.Err()
}

// ThreadByID returns a single thread with messages decoded.
func (db *DB) ThreadByID(id string) (domain.Thread, error) {
	row := db.QueryRow(`SELECT `+colThreads+` FROM threads WHERE id = ?`, id)
	var t domain.Thread
	var messagesJSON string
	err := row.Scan(&t.ID, &t.Customer, &t.Email, &t.Subject, &t.Ref, &t.Unread,
		&t.CustomerUnread, (*string)(&t.Status), &t.LastActive, &messagesJSON)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Thread{}, ErrNotFound
	}
	if err != nil {
		return domain.Thread{}, err
	}
	_ = json.Unmarshal([]byte(messagesJSON), &t.Messages)
	return t, nil
}

// SaveThread persists a thread (used after appending a message or toggling read state).
// New threads (a customer's first message) must be INSERTed since they have no row yet,
// so this is an upsert keyed on the thread id.
func (db *DB) SaveThread(t domain.Thread) error {
	messages, err := json.Marshal(t.Messages)
	if err != nil {
		return err
	}
	_, err = db.Exec(
		`INSERT INTO threads (id, customer, email, subject, ref, unread, customer_unread, status, last_active, messages)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET unread = excluded.unread, customer_unread = excluded.customer_unread,
		   status = excluded.status, last_active = excluded.last_active, messages = excluded.messages`,
		t.ID, t.Customer, t.Email, t.Subject, t.Ref, t.Unread, t.CustomerUnread, t.Status, t.LastActive, string(messages),
	)
	return err
}

// ---- quotes

func (db *DB) AllQuotes() ([]domain.Quote, error) {
	rows, err := db.Query(`SELECT ` + colQuotes + ` FROM quotes ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Quote, 0)
	for rows.Next() {
		var q domain.Quote
		var imagesJSON string
		if err := rows.Scan(&q.ID, &q.RequestID, &q.Product, &q.Customer, &q.Supplier,
			&q.ValueUSD, &q.MarginBps, (*string)(&q.Status), &q.IssuedAt, &q.ExpiresAt,
			&imagesJSON, &q.DecidedAt, &q.DecisionReason); err != nil {
			return nil, err
		}
		q.ImageURLs = decodeImageURLs(imagesJSON)
		out = append(out, q)
	}
	return out, rows.Err()
}

// InsertQuote stores a freshly issued quote.
func (db *DB) InsertQuote(q domain.Quote) error {
	_, err := db.Exec(
		`INSERT INTO quotes (id, request_id, product, customer, supplier, value_usd, margin_bps, status, issued_at, expires_at, image_urls, decided_at, decision_reason)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		q.ID, q.RequestID, q.Product, q.Customer, q.Supplier, q.ValueUSD, q.MarginBps,
		q.Status, q.IssuedAt, q.ExpiresAt, encodeImageURLs(q.ImageURLs),
		q.DecidedAt, q.DecisionReason,
	)
	return err
}

// UpdateQuoteDecision records a customer's accept/decline on the quote linked
// to the given request. ErrNotFound is returned when no quote exists for it.
func (db *DB) UpdateQuoteDecision(requestID string, status domain.QuoteStatus, decidedAt, reason string) error {
	res, err := db.Exec(
		`UPDATE quotes SET status = ?, decided_at = ?, decision_reason = ? WHERE request_id = ?`,
		status, decidedAt, reason, requestID,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// ---- activity

func (db *DB) AllActivity() ([]domain.Activity, error) {
	rows, err := db.Query(`SELECT ` + colActivity + ` FROM activity ORDER BY rowid DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Activity, 0)
	for rows.Next() {
		var a domain.Activity
		if err := rows.Scan(&a.ID, &a.Actor, &a.Action, &a.Target, &a.RequestID, &a.At,
			(*string)(&a.Tone)); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// InsertActivity prepends a feed item.
func (db *DB) InsertActivity(a domain.Activity) error {
	_, err := db.Exec(
		`INSERT INTO activity (id, actor, action, target, request_id, at, tone) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.Actor, a.Action, a.Target, a.RequestID, a.At, a.Tone,
	)
	return err
}

// ---- sourcing requests

func (db *DB) AllRequests() ([]domain.SourcingRequest, error) {
	rows, err := db.Query(`SELECT ` + colRequests + ` FROM sourcing_requests ORDER BY date DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.SourcingRequest, 0)
	for rows.Next() {
		var r domain.SourcingRequest
		var imagesJSON string
		if err := rows.Scan(&r.ID, &r.Product, &r.Category, &r.Customer, &r.City, &r.Quantity,
			&r.Budget, &r.Currency, (*string)(&r.Status), &r.Date, &r.SubmittedBy,
			&r.SupplierHint, &r.Destination, &r.NotesBody, &r.ContactPhone, &imagesJSON); err != nil {
			return nil, err
		}
		r.ImageURLs = decodeImageURLs(imagesJSON)
		out = append(out, r)
	}
	return out, rows.Err()
}

// InsertRequest stores a request submitted through the portal.
func (db *DB) InsertRequest(r domain.SourcingRequest) error {
	_, err := db.Exec(
		`INSERT INTO sourcing_requests (id, product, category, customer, city, quantity, budget, currency, status, date, submitted_by, supplier_hint, destination, notes_body, contact_phone, image_urls)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		r.ID, r.Product, r.Category, r.Customer, r.City, r.Quantity, r.Budget, r.Currency,
		r.Status, r.Date, r.SubmittedBy, r.SupplierHint, r.Destination, r.NotesBody,
		r.ContactPhone, encodeImageURLs(r.ImageURLs),
	)
	return err
}

// UpdateRequestStatus changes a request and returns the updated row.
func (db *DB) UpdateRequestStatus(id string, status domain.RequestStatus) (domain.SourcingRequest, error) {
	res, err := db.Exec(`UPDATE sourcing_requests SET status = ? WHERE id = ?`, status, id)
	if err != nil {
		return domain.SourcingRequest{}, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.SourcingRequest{}, ErrNotFound
	}
	row := db.QueryRow(`SELECT `+colRequests+` FROM sourcing_requests WHERE id = ?`, id)
	var r domain.SourcingRequest
	var imagesJSON string
	if err := row.Scan(&r.ID, &r.Product, &r.Category, &r.Customer, &r.City, &r.Quantity,
		&r.Budget, &r.Currency, (*string)(&r.Status), &r.Date, &r.SubmittedBy,
		&r.SupplierHint, &r.Destination, &r.NotesBody, &r.ContactPhone, &imagesJSON); err != nil {
		return domain.SourcingRequest{}, err
	}
	r.ImageURLs = decodeImageURLs(imagesJSON)
	return r, nil
}

// RequestByID returns one request.
func (db *DB) RequestByID(id string) (domain.SourcingRequest, error) {
	row := db.QueryRow(`SELECT `+colRequests+` FROM sourcing_requests WHERE id = ?`, id)
	var r domain.SourcingRequest
	var imagesJSON string
	err := row.Scan(&r.ID, &r.Product, &r.Category, &r.Customer, &r.City, &r.Quantity,
		&r.Budget, &r.Currency, (*string)(&r.Status), &r.Date, &r.SubmittedBy,
		&r.SupplierHint, &r.Destination, &r.NotesBody, &r.ContactPhone, &imagesJSON)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.SourcingRequest{}, ErrNotFound
	}
	r.ImageURLs = decodeImageURLs(imagesJSON)
	return r, err
}

// encodeImageURLs serializes an image list for storage as a JSON array.
func encodeImageURLs(urls []string) string {
	if len(urls) == 0 {
		return "[]"
	}
	b, err := json.Marshal(urls)
	if err != nil {
		return "[]"
	}
	return string(b)
}

// decodeImageURLs parses the stored JSON array back into an image list.
func decodeImageURLs(raw string) []string {
	if raw == "" {
		return nil
	}
	var urls []string
	if err := json.Unmarshal([]byte(raw), &urls); err != nil {
		return nil
	}
	return urls
}

// ---- notifications

func (db *DB) AllAdminNotifications() ([]domain.AdminNotification, error) {
	rows, err := db.Query(`SELECT ` + colAdminNotifs + ` FROM admin_notifications ORDER BY read, rowid DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.AdminNotification, 0)
	for rows.Next() {
		var n domain.AdminNotification
		var read int
		if err := rows.Scan(&n.ID, &n.Kind, &n.Message, &n.Time, &read, &n.Href); err != nil {
			return nil, err
		}
		n.Read = read == 1
		out = append(out, n)
	}
	return out, rows.Err()
}

// MarkAllAdminNotificationsRead clears the badge on every unread admin notification.
func (db *DB) MarkAllAdminNotificationsRead() error {
	_, err := db.Exec(`UPDATE admin_notifications SET read = 1`)
	return err
}

// InsertAdminNotification prepends a fresh notification for the staff console.
func (db *DB) InsertAdminNotification(n domain.AdminNotification) error {
	read := 0
	if n.Read {
		read = 1
	}
	_, err := db.Exec(
		`INSERT INTO admin_notifications (id, kind, message, time, read, href) VALUES (?, ?, ?, ?, ?, ?)`,
		n.ID, n.Kind, n.Message, n.Time, read, n.Href,
	)
	return err
}

// MarkAdminNotificationRead marks a single admin notification as read.
func (db *DB) MarkAdminNotificationRead(id string) error {
	res, err := db.Exec(`UPDATE admin_notifications SET read = 1 WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (db *DB) AllCustomerNotifications() ([]domain.CustomerNotification, error) {
	rows, err := db.Query(`SELECT ` + colCustomerNotifs + ` FROM customer_notifications ORDER BY rowid DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.CustomerNotification, 0)
	for rows.Next() {
		var n domain.CustomerNotification
		var read int
		if err := rows.Scan(&n.ID, &n.Title, &n.Body, &n.At, &read, &n.RequestID); err != nil {
			return nil, err
		}
		n.Read = read == 1
		out = append(out, n)
	}
	return out, rows.Err()
}

func (db *DB) MarkAllCustomerNotificationsRead() error {
	_, err := db.Exec(`UPDATE customer_notifications SET read = 1`)
	return err
}

// InsertCustomerNotification prepends a fresh notification for the portal.
func (db *DB) InsertCustomerNotification(n domain.CustomerNotification) error {
	read := 0
	if n.Read {
		read = 1
	}
	_, err := db.Exec(
		`INSERT INTO customer_notifications (id, title, body, at, read, request_id) VALUES (?, ?, ?, ?, ?, ?)`,
		n.ID, n.Title, n.Body, n.At, read, n.RequestID,
	)
	return err
}

// MarkCustomerNotificationRead marks a single portal notification as read.
func (db *DB) MarkCustomerNotificationRead(id string) error {
	res, err := db.Exec(`UPDATE customer_notifications SET read = 1 WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// ---- orders

func (db *DB) AllOrders() ([]domain.Order, error) {
	rows, err := db.Query(`SELECT ` + colOrders + ` FROM orders ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Order, 0)
	for rows.Next() {
		var o domain.Order
		if err := rows.Scan(&o.ID, &o.RequestID, &o.Customer, &o.Product, &o.Supplier, &o.Quantity,
			&o.UnitPriceUSD, &o.ValueUSD, (*string)(&o.Status), &o.Date, &o.ETA); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

// InsertOrder stores a new order. Orders are created automatically when a
// customer approves their quote, so the pipeline can flow without manual entry.
func (db *DB) InsertOrder(o domain.Order) error {
	_, err := db.Exec(
		`INSERT INTO orders (id, request_id, customer, product, supplier, quantity, unit_price_usd, value_usd, status, date, eta)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		o.ID, o.RequestID, o.Customer, o.Product, o.Supplier, o.Quantity,
		o.UnitPriceUSD, o.ValueUSD, o.Status, o.Date, o.ETA,
	)
	return err
}

// OrderByID returns one order.
func (db *DB) OrderByID(id string) (domain.Order, error) {
	row := db.QueryRow(`SELECT `+colOrders+` FROM orders WHERE id = ?`, id)
	var o domain.Order
	err := row.Scan(&o.ID, &o.RequestID, &o.Customer, &o.Product, &o.Supplier, &o.Quantity,
		&o.UnitPriceUSD, &o.ValueUSD, (*string)(&o.Status), &o.Date, &o.ETA)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Order{}, ErrNotFound
	}
	return o, err
}

// UpdateOrderStatus sets an order's stage and returns the updated order.
func (db *DB) UpdateOrderStatus(id string, status domain.OrderStatus) (domain.Order, error) {
	res, err := db.Exec(`UPDATE orders SET status = ? WHERE id = ?`, status, id)
	if err != nil {
		return domain.Order{}, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.Order{}, ErrNotFound
	}
	return db.OrderByID(id)
}

// ---- inspections

func (db *DB) AllInspections() ([]domain.Inspection, error) {
	rows, err := db.Query(`SELECT ` + colInspections + ` FROM inspections ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Inspection, 0)
	for rows.Next() {
		var i domain.Inspection
		if err := rows.Scan(&i.ID, &i.OrderID, &i.Customer, &i.Supplier, &i.Product, &i.Quantity,
			(*string)(&i.Status), &i.ScheduledAt, &i.Inspector, &i.Notes); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

// ---- contact (marketing)

// InsertContact stores a marketing contact submission and returns its id.
func (db *DB) InsertContact(name, email, message string) (string, error) {
	id := "MSG-" + strings.ToUpper(time.Now().Format("0102-150405"))
	_, err := db.Exec(
		`INSERT INTO contact_messages (id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?)`,
		id, name, email, message, time.Now().UTC().Format(time.RFC3339),
	)
	return id, err
}

// ---- push subscriptions

// UpsertPushSubscription stores a browser subscription for a user, refreshing
// the keys and owner when a device re-subscribes.
func (db *DB) UpsertPushSubscription(sub domain.PushSubscription) error {
	_, err := db.Exec(
		`INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_email, user_role, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(endpoint) DO UPDATE SET
		   p256dh = excluded.p256dh,
		   auth = excluded.auth,
		   user_email = excluded.user_email,
		   user_role = excluded.user_role`,
		sub.Endpoint, sub.P256dh, sub.Auth, sub.UserEmail, sub.UserRole, sub.CreatedAt,
	)
	return err
}

// DeletePushSubscription removes a subscription the push service discarded.
func (db *DB) DeletePushSubscription(endpoint string) error {
	_, err := db.Exec(`DELETE FROM push_subscriptions WHERE endpoint = ?`, endpoint)
	return err
}

// PushSubscriptionForUser returns a single subscription owned by a user, which
// lets the API answer "is this device registered?" without leaking others.
func (db *DB) PushSubscriptionForUser(endpoint, email string) (domain.PushSubscription, bool, error) {
	var sub domain.PushSubscription
	row := db.QueryRow(
		`SELECT endpoint, p256dh, auth, user_email, user_role, created_at
		 FROM push_subscriptions WHERE endpoint = ? AND user_email = ?`,
		endpoint, email,
	)
	if err := row.Scan(&sub.Endpoint, &sub.P256dh, &sub.Auth, &sub.UserEmail, &sub.UserRole, &sub.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return sub, false, nil
		}
		return sub, false, err
	}
	return sub, true, nil
}

// PushSubscriptionsByRole returns every device registered for a role.
func (db *DB) PushSubscriptionsByRole(role string) ([]domain.PushSubscription, error) {
	return db.queryPushSubscriptions(` AND user_role = ?`, role)
}

// PushSubscriptionsByUser returns only the devices one account registered.
// The delivery test uses this so a user confirms their own devices instead of
// every device that happens to share their role.
func (db *DB) PushSubscriptionsByUser(email string) ([]domain.PushSubscription, error) {
	return db.queryPushSubscriptions(` AND user_email = ?`, email)
}

func (db *DB) queryPushSubscriptions(where string, arg any) ([]domain.PushSubscription, error) {
	rows, err := db.Query(
		`SELECT endpoint, p256dh, auth, user_email, user_role, created_at
		 FROM push_subscriptions WHERE 1 = 1`+where+` ORDER BY created_at`,
		arg,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.PushSubscription, 0)
	for rows.Next() {
		var sub domain.PushSubscription
		if err := rows.Scan(&sub.Endpoint, &sub.P256dh, &sub.Auth, &sub.UserEmail, &sub.UserRole, &sub.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, sub)
	}
	return out, rows.Err()
}
