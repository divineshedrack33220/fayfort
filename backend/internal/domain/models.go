// Package domain holds the Fayfort data model: entity types and the shared
// status vocabulary, mirrored one-to-one from the frontend prototype
// (frontend/lib/status.ts and frontend/lib/admin.ts).
package domain

// RequestStatus mirrors REQUEST_STATUSES from the frontend.
type RequestStatus string

const (
	RequestSubmitted      RequestStatus = "SUBMITTED"
	RequestUnderReview    RequestStatus = "UNDER_REVIEW"
	RequestSupplierSearch RequestStatus = "SUPPLIER_SEARCH"
	RequestQuoteReady     RequestStatus = "QUOTE_READY"
	RequestCustomerAppr   RequestStatus = "CUSTOMER_APPROVAL"
	RequestApproved       RequestStatus = "APPROVED"
	RequestInProgress     RequestStatus = "IN_PROGRESS"
	RequestConverted      RequestStatus = "CONVERTED"
	RequestCompleted      RequestStatus = "COMPLETED"
	RequestClosed         RequestStatus = "CLOSED"
	RequestCancelled      RequestStatus = "CANCELLED"
)

var RequestStatuses = []RequestStatus{
	RequestSubmitted, RequestUnderReview, RequestSupplierSearch, RequestQuoteReady,
	RequestCustomerAppr, RequestApproved, RequestInProgress, RequestConverted,
	RequestCompleted, RequestClosed, RequestCancelled,
}

// QuoteStatus mirrors QUOTE_STATUSES.
type QuoteStatus string

const (
	QuoteDraft    QuoteStatus = "DRAFT"
	QuoteSent     QuoteStatus = "SENT"
	QuotePending  QuoteStatus = "PENDING"
	QuoteApproved QuoteStatus = "APPROVED"
	QuoteDeclined QuoteStatus = "DECLINED"
	QuoteExpired  QuoteStatus = "EXPIRED"
)

var QuoteStatuses = []QuoteStatus{QuoteDraft, QuoteSent, QuotePending, QuoteApproved, QuoteDeclined, QuoteExpired}

// CustomerStatus mirrors CUSTOMER_STATUSES.
type CustomerStatus string

const (
	CustomerNew    CustomerStatus = "NEW"
	CustomerActive CustomerStatus = "ACTIVE"
	CustomerAtRisk CustomerStatus = "AT_RISK"
)

var CustomerStatuses = []CustomerStatus{CustomerNew, CustomerActive, CustomerAtRisk}

// SupplierStatus mirrors SUPPLIER_STATUSES.
type SupplierStatus string

const (
	SupplierVerified SupplierStatus = "VERIFIED"
	SupplierPending  SupplierStatus = "PENDING"
	SupplierAtRisk   SupplierStatus = "AT_RISK"
)

// ShipmentStatus mirrors SHIPMENT_STATUSES.
type ShipmentStatus string

const (
	ShipmentBooked    ShipmentStatus = "BOOKED"
	ShipmentInTransit ShipmentStatus = "IN_TRANSIT"
	ShipmentCustoms   ShipmentStatus = "CUSTOMS"
	ShipmentDelayed   ShipmentStatus = "DELAYED"
	ShipmentDelivered ShipmentStatus = "DELIVERED"
)

var ShipmentStatuses = []ShipmentStatus{ShipmentBooked, ShipmentInTransit, ShipmentCustoms, ShipmentDelayed, ShipmentDelivered}

// SupportThreadStatus mirrors SUPPORT_THREAD_STATUSES.
type SupportThreadStatus string

const (
	ThreadOpen       SupportThreadStatus = "OPEN"
	ThreadNeedsReply SupportThreadStatus = "NEEDS_REPLY"
	ThreadResolved   SupportThreadStatus = "RESOLVED"
)

// OrderStatus mirrors ORDER_STATUSES.
type OrderStatus string

const (
	OrderPayment            OrderStatus = "PAYMENT"
	OrderPurchasing         OrderStatus = "PURCHASING"
	OrderSupplierProcessing OrderStatus = "SUPPLIER_PROCESSING"
	OrderInspection         OrderStatus = "INSPECTION"
	OrderWarehouse          OrderStatus = "WAREHOUSE"
	OrderShipping           OrderStatus = "SHIPPING"
	OrderDelivered          OrderStatus = "DELIVERED"
)

var OrderStatuses = []OrderStatus{OrderPayment, OrderPurchasing, OrderSupplierProcessing, OrderInspection, OrderWarehouse, OrderShipping, OrderDelivered}

// InspectionStatus mirrors INSPECTION_STATUSES.
type InspectionStatus string

const (
	InspectionPending    InspectionStatus = "PENDING"
	InspectionInProgress InspectionStatus = "IN_PROGRESS"
	InspectionPassed     InspectionStatus = "PASSED"
	InspectionIssues     InspectionStatus = "ISSUES"
	InspectionCompleted  InspectionStatus = "COMPLETED"
)

var InspectionStatuses = []InspectionStatus{InspectionPending, InspectionInProgress, InspectionPassed, InspectionIssues, InspectionCompleted}

// Tone mirrors the frontend Tone type used by activity + status metadata.
type Tone string

const (
	ToneNeutral Tone = "neutral"
	ToneBrand   Tone = "brand"
	ToneInfo    Tone = "info"
	ToneSuccess Tone = "success"
	ToneWarning Tone = "warning"
	ToneDanger  Tone = "danger"
	ToneAccent  Tone = "accent"
)

// User is an account that can sign in (staff or customer).
type User struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
	Role         string `json:"role"` // "admin" | "customer"
	Status       string `json:"status"`
	AvatarURL    string `json:"avatarUrl,omitempty"`
	CreatedAt    string `json:"createdAt"`
}

// Customer mirrors AdminCustomer.
type Customer struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Email         string         `json:"email"`
	Company       string         `json:"company,omitempty"`
	City          string         `json:"city"`
	Currency      string         `json:"currency"`
	Requests      int            `json:"requests"`
	PipelineValue float64        `json:"pipelineValue"`
	Joined        string         `json:"joined"`
	Status        CustomerStatus `json:"status"`
}

// Supplier mirrors AdminSupplier.
type Supplier struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	City         string         `json:"city"`
	Country      string         `json:"country"`
	Category     string         `json:"category"`
	Reliability  int            `json:"reliability"`
	LeadDays     string         `json:"leadDays"`
	MOQ          string         `json:"moq"`
	ContactEmail string         `json:"contactEmail"`
	ContactPhone string         `json:"contactPhone"`
	PaymentTerms string         `json:"paymentTerms"`
	Products     []string       `json:"products"`
	Notes        string         `json:"notes"`
	Requests     int            `json:"requests"`
	Since        string         `json:"since"`
	Status       SupplierStatus `json:"status"`
}

// Shipment mirrors AdminShipment.
type Shipment struct {
	ID           string         `json:"id"`
	RequestID    string         `json:"requestId"`
	Product      string         `json:"product"`
	Customer     string         `json:"customer"`
	Supplier     string         `json:"supplier"`
	Carrier      string         `json:"carrier"`
	Mode         string         `json:"mode"` // FCL | LCL | Air
	Origin       string         `json:"origin"`
	Destination  string         `json:"destination"`
	ContainerRef string         `json:"containerRef"`
	DepartedAt   string         `json:"departedAt,omitempty"`
	ETA          string         `json:"eta,omitempty"`
	DeliveredAt  string         `json:"deliveredAt,omitempty"`
	Status       ShipmentStatus `json:"status"`
}

// ThreadMessage mirrors AdminThreadMessage.
type ThreadMessage struct {
	ID     string `json:"id"`
	From   string `json:"from"` // "customer" | "staff"
	Author string `json:"author"`
	Text   string `json:"text"`
	At     string `json:"at"`
	// Attachments holds optional media (image/video) sent with the message.
	Attachments []ThreadAttachment `json:"attachments,omitempty"`
}

// ThreadAttachment is one media attachment on a chat message. URL comes from
// a signed Cloudinary upload; Kind is "image" | "video".
type ThreadAttachment struct {
	URL  string `json:"url"`
	Kind string `json:"kind"`
}

// Thread mirrors AdminThread.
type Thread struct {
	ID       string `json:"id"`
	Customer string `json:"customer"`
	Email    string `json:"email"`
	Subject  string `json:"subject"`
	Ref      string `json:"ref"`
	Unread   int    `json:"unread"`
	// CustomerUnread is the number of staff messages waiting for the customer
	// to read — distinct from Unread, which counts customer messages awaiting
	// the staff. Bumped on every staff reply, cleared when the customer opens
	// the thread or writes back.
	CustomerUnread int                 `json:"customerUnread"`
	Status         SupportThreadStatus `json:"status"`
	LastActive     string              `json:"lastActive"`
	Messages       []ThreadMessage     `json:"messages"`
}

// Quote mirrors AdminQuote.
type Quote struct {
	ID        string      `json:"id"`
	RequestID string      `json:"requestId"`
	Product   string      `json:"product"`
	Customer  string      `json:"customer"`
	Supplier  string      `json:"supplier"`
	ValueUSD  float64     `json:"valueUsd"`
	MarginBps int         `json:"marginBps"`
	Status    QuoteStatus `json:"status"`
	IssuedAt  string      `json:"issuedAt"`
	ExpiresAt string      `json:"expiresAt"`
	// DecidedAt and DecisionReason record when/how the customer responded.
	DecidedAt      string `json:"decidedAt,omitempty"`
	DecisionReason string `json:"decisionReason,omitempty"`
	// ImageURLs holds the supplier/product photo references attached to the quote.
	ImageURLs []string `json:"imageUrls,omitempty"`
}

// Activity mirrors AdminActivity.
type Activity struct {
	ID        string `json:"id"`
	Actor     string `json:"actor"`
	Action    string `json:"action"`
	Target    string `json:"target,omitempty"`
	RequestID string `json:"requestId,omitempty"`
	At        string `json:"at"`
	Tone      Tone   `json:"tone"`
}

// SourcingRequest mirrors AdminRequestRow (the admin queue row).
type SourcingRequest struct {
	ID       string        `json:"id"`
	Product  string        `json:"product"`
	Category string        `json:"category"`
	Customer string        `json:"customer"`
	City     string        `json:"city"`
	Quantity int           `json:"quantity"`
	Budget   float64       `json:"budget"`
	Currency string        `json:"currency"`
	Status   RequestStatus `json:"status"`
	Date     string        `json:"date"`
	// Contact details captured when a customer submits a request through the portal.
	SubmittedBy  string `json:"submittedBy,omitempty"`
	SupplierHint string `json:"supplierHint,omitempty"`
	Destination  string `json:"destination,omitempty"`
	NotesBody    string `json:"notes,omitempty"`
	// ContactPhone is the customer's WhatsApp/call number captured at filing time.
	ContactPhone string `json:"contactPhone,omitempty"`
	// ImageURLs holds the optional customer attachments (photos/references) for the product.
	ImageURLs []string `json:"imageUrls,omitempty"`
}

// AdminNotification mirrors AdminNotification.
type AdminNotification struct {
	ID      string `json:"id"`
	Kind    string `json:"kind"` // request | quote | inspection | shipment | customer
	Message string `json:"message"`
	Time    string `json:"time"`
	Read    bool   `json:"read"`
	Href    string `json:"href"`
}

// CustomerNotification mirrors lib/notifications.ts NotificationItem.
type CustomerNotification struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	At        string `json:"at"`
	Read      bool   `json:"read"`
	RequestID string `json:"requestId,omitempty"`
}

// PushSubscription is one browser device registered for Web Push. The endpoint
// is the push service URL and doubles as the primary key; the keys are the
// base64 values the browser handed us when the user opted in.
type PushSubscription struct {
	Endpoint  string `json:"endpoint"`
	P256dh    string `json:"p256dh"`
	Auth      string `json:"auth"`
	UserEmail string `json:"userEmail"`
	UserRole  string `json:"userRole"`
	CreatedAt string `json:"createdAt"`
}

// Order mirrors AdminOrder.
type Order struct {
	ID           string      `json:"id"`
	RequestID    string      `json:"requestId"`
	Customer     string      `json:"customer"`
	Product      string      `json:"product"`
	Supplier     string      `json:"supplier"`
	Quantity     int         `json:"quantity"`
	UnitPriceUSD float64     `json:"unitPriceUsd"`
	ValueUSD     float64     `json:"valueUsd"`
	Status       OrderStatus `json:"status"`
	Date         string      `json:"date"`
	ETA          string      `json:"eta,omitempty"`
}

// Inspection mirrors AdminInspection.
type Inspection struct {
	ID          string           `json:"id"`
	OrderID     string           `json:"orderId"`
	Customer    string           `json:"customer"`
	Supplier    string           `json:"supplier"`
	Product     string           `json:"product"`
	Quantity    int              `json:"quantity"`
	Status      InspectionStatus `json:"status"`
	ScheduledAt string           `json:"scheduledAt"`
	Inspector   string           `json:"inspector"`
	Notes       string           `json:"notes,omitempty"`
}

// SupplierRevision is the app-level settings snapshot.
type Settings struct {
	Demo bool `json:"demo"`
}
