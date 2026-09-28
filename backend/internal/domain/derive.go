package domain

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// Kpi mirrors AdminKpi.
type Kpi struct {
	Label string  `json:"label"`
	Value string  `json:"value"`
	Delta float64 `json:"delta"`
	Hint  string  `json:"hint"`
}

// PipelineStage mirrors PipelineStage.
type PipelineStage struct {
	Key      string          `json:"key"`
	Label    string          `json:"label"`
	Count    int             `json:"count"`
	Statuses []RequestStatus `json:"statuses"`
}

var pipelineStageDefs = []struct {
	Key, Label string
	Statuses   []RequestStatus
}{
	{"SUBMITTED", "Submitted", []RequestStatus{RequestSubmitted}},
	{"UNDER_REVIEW", "Under review", []RequestStatus{RequestUnderReview}},
	{"SUPPLIER_SEARCH", "Supplier search", []RequestStatus{RequestSupplierSearch}},
	{"QUOTE_PREPARED", "Quote prepared", []RequestStatus{RequestQuoteReady}},
	{"CUSTOMER_APPROVED", "Customer approved", []RequestStatus{RequestCustomerAppr}},
	{"PURCHASING", "Purchasing", []RequestStatus{RequestApproved, RequestInProgress}},
	{"INSPECTION", "Inspection", []RequestStatus{RequestConverted}},
	{"SHIPPING", "Shipping", []RequestStatus{RequestCompleted}},
	{"DELIVERED", "Delivered", []RequestStatus{RequestClosed}},
}

// PipelineStageStatuses returns the request statuses mapped to a stage key.
func PipelineStageStatuses(key string) []RequestStatus {
	for _, def := range pipelineStageDefs {
		if def.Key == key {
			return def.Statuses
		}
	}
	return nil
}

// RequestPipeline mirrors requestPipeline().
func RequestPipeline(requests []SourcingRequest) []PipelineStage {
	stages := make([]PipelineStage, 0, len(pipelineStageDefs))
	for _, def := range pipelineStageDefs {
		count := 0
		for _, row := range requests {
			for _, s := range def.Statuses {
				if row.Status == s {
					count++
				}
			}
		}
		stages = append(stages, PipelineStage{Key: def.Key, Label: def.Label, Count: count, Statuses: def.Statuses})
	}
	return stages
}

// StatusCount mirrors StatusCount.
type StatusCount struct {
	Status RequestStatus `json:"status"`
	Count  int           `json:"count"`
}

// StatusCounts derives per-status counts from live requests.
func StatusCounts(requests []SourcingRequest) []StatusCount {
	counts := map[RequestStatus]int{}
	var order []RequestStatus
	for _, r := range requests {
		if _, seen := counts[r.Status]; !seen {
			order = append(order, r.Status)
		}
		counts[r.Status]++
	}
	out := make([]StatusCount, 0, len(order))
	for _, s := range order {
		out = append(out, StatusCount{s, counts[s]})
	}
	return out
}

// DayCount mirrors DayCount (requests this week).
type DayCount struct {
	Day   string `json:"day"`
	Count int    `json:"count"`
}

// RequestsThisWeek derives per-weekday counts for the running week from live
// requests whose submitted date falls inside it.
func RequestsThisWeek(requests []SourcingRequest) []DayCount {
	now := time.Now()
	weekday := int(now.Weekday()) // 0 = Sunday
	mondayOffset := 1 - weekday
	if weekday == 0 {
		mondayOffset = -6
	}
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	monday := today.AddDate(0, 0, mondayOffset)
	sunday := monday.AddDate(0, 0, 6)

	counts := map[string]int{}
	for _, r := range requests {
		ts, err := time.Parse("Jan 2, 2006", r.Date)
		if err != nil {
			continue
		}
		if ts.Before(monday) || ts.After(sunday) {
			continue
		}
		counts[ts.Weekday().String()[:3]]++
	}

	days := []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
	out := make([]DayCount, 0)
	for _, d := range days {
		if counts[d] > 0 {
			out = append(out, DayCount{d, counts[d]})
		}
	}
	return out
}

// MonthCount mirrors MonthCount.
type MonthCount struct {
	Month string `json:"month"`
	Count int    `json:"count"`
}

// OrdersByMonth mirrors ORDERS_BY_MONTH, derived from orders.
func OrdersByMonth(orders []Order) []MonthCount {
	orderMonths := []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}
	counts := map[string]int{}
	for _, o := range orders {
		month := strings.Split(o.Date, " ")[0]
		if month != "" {
			counts[month]++
		}
	}
	out := make([]MonthCount, 0)
	for _, m := range orderMonths {
		if counts[m] > 0 {
			out = append(out, MonthCount{m, counts[m]})
		}
	}
	return out
}

// TopProduct mirrors a row of TOP_REQUESTED_PRODUCTS.
type TopProduct struct {
	Product  string  `json:"product"`
	Count    int     `json:"count"`
	ValueUSD float64 `json:"valueUsd"`
}

// TopProducts derives the most-requested products from live requests, ranked
// by number of requests (valueUsd is the summed budget of those requests).
func TopProducts(requests []SourcingRequest) []TopProduct {
	type agg struct {
		count int
		value float64
	}
	groups := map[string]*agg{}
	var order []string
	for _, r := range requests {
		a, ok := groups[r.Product]
		if !ok {
			a = &agg{}
			groups[r.Product] = a
			order = append(order, r.Product)
		}
		a.count++
		a.value += r.Budget
	}
	out := make([]TopProduct, 0, len(order))
	for _, p := range order {
		out = append(out, TopProduct{p, groups[p].count, groups[p].value})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Count > out[j].Count })
	if len(out) > 5 {
		out = out[:5]
	}
	return out
}

// TopCustomer mirrors a row of TOP_CUSTOMERS.
type TopCustomer struct {
	Name  string  `json:"name"`
	Value float64 `json:"value"`
}

// TopCustomers mirrors TOP_CUSTOMERS.
func TopCustomers(customers []Customer) []TopCustomer {
	sorted := append([]Customer(nil), customers...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].PipelineValue > sorted[j].PipelineValue })
	if len(sorted) > 4 {
		sorted = sorted[:4]
	}
	out := make([]TopCustomer, 0, len(sorted))
	for _, c := range sorted {
		out = append(out, TopCustomer{c.Name, c.PipelineValue})
	}
	return out
}

// TopSupplier mirrors a row of TOP_SUPPLIERS.
type TopSupplier struct {
	Name        string `json:"name"`
	Orders      int    `json:"orders"`
	Reliability int    `json:"reliability"`
}

// TopSuppliers mirrors TOP_SUPPLIERS.
func TopSuppliers(suppliers []Supplier) []TopSupplier {
	sorted := append([]Supplier(nil), suppliers...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Requests > sorted[j].Requests })
	if len(sorted) > 4 {
		sorted = sorted[:4]
	}
	out := make([]TopSupplier, 0, len(sorted))
	for _, s := range sorted {
		out = append(out, TopSupplier{s.Name, s.Requests, s.Reliability})
	}
	return out
}

// AdminKpis mirrors adminKpis(), computed from live data.
func AdminKpis(customers []Customer, quotes []Quote, requests []SourcingRequest) []Kpi {
	pipelineValue := 0.0
	for _, c := range customers {
		pipelineValue += c.PipelineValue
	}
	activeRequests := 0
	closedTotal := 0
	totalRequests := len(requests)
	for _, r := range requests {
		switch r.Status {
		case RequestSubmitted, RequestUnderReview, RequestSupplierSearch,
			RequestQuoteReady, RequestCustomerAppr, RequestInProgress:
			activeRequests++
		case RequestConverted, RequestCompleted, RequestClosed:
			closedTotal++
		}
	}
	quotesPending := 0
	for _, q := range quotes {
		if q.Status == QuotePending || q.Status == QuoteSent {
			quotesPending++
		}
	}
	closeRate := 0
	if totalRequests > 0 {
		closeRate = (closedTotal * 100) / totalRequests
	}
	return []Kpi{
		{Label: "Pipeline value (₦)", Value: FormatNaira(pipelineValue), Delta: 0, Hint: "live total"},
		{Label: "Active requests", Value: fmt.Sprintf("%d", activeRequests), Delta: 0, Hint: "live total"},
		{Label: "Quotes awaiting reply", Value: fmt.Sprintf("%d", quotesPending), Delta: 0, Hint: "live total"},
		{Label: "Close-out rate", Value: fmt.Sprintf("%d%%", closeRate), Delta: 0, Hint: "live total"},
	}
}

// ActiveOrdersCount mirrors activeOrdersCount().
func ActiveOrdersCount(orders []Order) int {
	count := 0
	for _, o := range orders {
		if o.Status != OrderDelivered {
			count++
		}
	}
	return count
}

// ConversionRate mirrors conversionRate().
func ConversionRate(requests []SourcingRequest, orders []Order) int {
	total := len(requests)
	if total == 0 {
		return 0
	}
	return (len(orders) * 100) / total
}

// PendingActionsCount mirrors pendingActionsCount().
func PendingActionsCount(threads []Thread, inspections []Inspection, quotes []Quote) int {
	needsReply := 0
	for _, t := range threads {
		if t.Status == ThreadNeedsReply {
			needsReply++
		}
	}
	pending := 0
	for _, i := range inspections {
		if i.Status == InspectionPending {
			pending++
		}
	}
	drafts := 0
	for _, q := range quotes {
		if q.Status == QuoteDraft {
			drafts++
		}
	}
	return needsReply + pending + drafts
}

// Stage is a generic timeline step.
type Stage struct {
	Label string `json:"label"`
	State string `json:"state"` // done | active | pending
}

// ShipmentTimelineFromStatus mirrors shipmentTimelineFromStatus (7 phases).
func ShipmentTimelineFromStatus(status ShipmentStatus) []Stage {
	phases := []string{"Warehouse", "Dispatched", "In transit", "Arrived", "Customs", "Out for delivery", "Delivered"}
	index := map[ShipmentStatus]int{
		ShipmentBooked: 0, ShipmentInTransit: 2, ShipmentCustoms: 4, ShipmentDelayed: 2, ShipmentDelivered: 6,
	}[status]
	last := len(phases) - 1
	out := make([]Stage, 0, len(phases))
	for i, label := range phases {
		state := "pending"
		switch {
		case i < index:
			state = "done"
		case i == index:
			if index == last {
				state = "done"
			} else {
				state = "active"
			}
		}
		out = append(out, Stage{label, state})
	}
	return out
}

// OrderTimelineFromStatus mirrors orderTimelineFromStatus.
func OrderTimelineFromStatus(status OrderStatus) []Stage {
	phases := []string{"Payment", "Purchasing", "Supplier processing", "Inspection", "Warehouse", "Shipping", "Delivered"}
	index := map[OrderStatus]int{
		OrderPayment: 0, OrderPurchasing: 1, OrderSupplierProcessing: 2, OrderInspection: 3,
		OrderWarehouse: 4, OrderShipping: 5, OrderDelivered: 6,
	}[status]
	return mapStages(phases, index)
}

func mapStages(phases []string, active int) []Stage {
	out := make([]Stage, 0, len(phases))
	for i, label := range phases {
		state := "pending"
		switch {
		case i < active:
			state = "done"
		case i == active:
			state = "active"
		}
		out = append(out, Stage{label, state})
	}
	return out
}

// VerificationStatus mirrors VerificationStatus.
type VerificationStatus string

const (
	VerificationVerified VerificationStatus = "VERIFIED"
	VerificationPending  VerificationStatus = "PENDING"
	VerificationFailed   VerificationStatus = "FAILED"
)

// VerificationItem mirrors VerificationItem.
type VerificationItem struct {
	Label  string             `json:"label"`
	Status VerificationStatus `json:"status"`
}

// SupplierVerification mirrors supplierVerification().
func SupplierVerification(supplier Supplier) []VerificationItem {
	labels := []string{"Business info", "Factory / warehouse", "Product samples", "Previous transactions", "Inspection records"}
	all := []VerificationStatus{VerificationVerified, VerificationVerified, VerificationPending, VerificationPending, VerificationPending}
	switch supplier.Status {
	case SupplierVerified:
		for i := range all {
			all[i] = VerificationVerified
		}
	case SupplierAtRisk:
		all = []VerificationStatus{VerificationVerified, VerificationFailed, VerificationVerified, VerificationVerified, VerificationFailed}
	}
	out := make([]VerificationItem, 0, len(labels))
	for i, label := range labels {
		out = append(out, VerificationItem{label, all[i]})
	}
	return out
}

// FilterRequests mirrors filterAdminRequests (status + free-text over id/product/customer/city).
func FilterRequests(requests []SourcingRequest, status *RequestStatus, query string) []SourcingRequest {
	q := strings.ToLower(strings.TrimSpace(query))
	out := make([]SourcingRequest, 0, len(requests))
	for _, row := range requests {
		if status != nil && row.Status != *status {
			continue
		}
		if q != "" {
			haystack := strings.ToLower(row.ID + " " + row.Product + " " + row.Customer + " " + row.City)
			if !strings.Contains(haystack, q) {
				continue
			}
		}
		out = append(out, row)
	}
	return out
}

// FormatNaira mirrors formatNaira (₦ with thousand separators, no decimals).
func FormatNaira(value float64) string {
	return "₦" + formatThousands(value)
}

// FormatUSD mirrors formatUsd.
func FormatUSD(value float64, fractionDigits int) string {
	neg := ""
	if value < 0 {
		neg = "-"
		value = -value
	}
	if fractionDigits > 0 {
		return fmt.Sprintf("%s$%s", neg, formatThousandsPrecise(value, fractionDigits))
	}
	return fmt.Sprintf("%s$%s", neg, formatThousands(value))
}

func formatThousands(value float64) string {
	rounded := int64(value + 0.5)
	return grouping(rounded)
}

func formatThousandsPrecise(value float64, digits int) string {
	// Scale, round, then split integer/fraction.
	scale := 1.0
	for i := 0; i < digits; i++ {
		scale *= 10
	}
	whole := int64(value)
	frac := int64((value-float64(whole))*scale + 0.5)
	if frac >= int64(scale) {
		whole++
		frac = 0
	}
	fracStr := fmt.Sprintf("%0*d", digits, frac)
	return grouping(whole) + "." + fracStr
}

func grouping(n int64) string {
	s := fmt.Sprintf("%d", n)
	out := ""
	for i, ch := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			out += ","
		}
		out += string(ch)
	}
	return out
}

// formatRequestDate adds `days` days to a "Sat, 22 Sep 2026"-style label and
// returns a short "Sep 22, 2026" representation, mirroring addDays().
func addDaysLabel(dateLabel string, days int) string {
	ts, err := time.Parse("Jan 2, 2006", dateLabel)
	if err != nil {
		return dateLabel
	}
	return ts.AddDate(0, 0, days).Format("Jan 2, 2006")
}

// PortalTimelineStage mirrors TimelineStage.
type PortalTimelineStage struct {
	Label string `json:"label"`
	State string `json:"state"` // done | active | pending
}

// TimelineFromStatus mirrors timelineFromStatus (customer portal 4-step line).
func TimelineFromStatus(status RequestStatus) []PortalTimelineStage {
	stages := []string{"Submitted", "Quote", "Approved", "Shipped"}
	active := 0
	switch status {
	case RequestCancelled, RequestSubmitted:
		active = 0
	case RequestUnderReview, RequestSupplierSearch, RequestQuoteReady:
		active = 1
	case RequestCustomerAppr:
		active = 2
	case RequestApproved, RequestConverted, RequestInProgress:
		active = 3
	case RequestCompleted, RequestClosed:
		active = 4
	}
	out := make([]PortalTimelineStage, 0, len(stages))
	for i, label := range stages {
		state := "pending"
		switch {
		case i < active:
			state = "done"
		case i == active:
			state = "active"
		}
		out = append(out, PortalTimelineStage{label, state})
	}
	return out
}
