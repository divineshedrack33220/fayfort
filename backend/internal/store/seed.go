package store

import (
	"encoding/json"
	"fmt"

	"fayfort/backend/internal/domain"
)

// SeedDemo populates the database with the exact demo records the frontend
// prototype renders from its static lib files. Idempotent: skips seeding a
// table that already has rows.
func (db *DB) SeedDemo() error {
	if err := db.seedCustomers(); err != nil {
		return err
	}
	if err := db.seedSuppliers(); err != nil {
		return err
	}
	if err := db.seedShipments(); err != nil {
		return err
	}
	if err := db.seedThreads(); err != nil {
		return err
	}
	if err := db.seedQuotes(); err != nil {
		return err
	}
	if err := db.seedActivity(); err != nil {
		return err
	}
	if err := db.seedRequests(); err != nil {
		return err
	}
	if err := db.seedAdminNotifications(); err != nil {
		return err
	}
	if err := db.seedCustomerNotifications(); err != nil {
		return err
	}
	if err := db.seedOrders(); err != nil {
		return err
	}
	return db.seedInspections()
}

func seeded(db *DB, table string) (bool, error) {
	var count int
	if err := db.QueryRow(fmt.Sprintf(`SELECT COUNT(*) FROM %s`, table)).Scan(&count); err != nil {
		return false, err
	}
	return count > 0, nil
}

func (db *DB) seedCustomers() error {
	if ok, err := seeded(db, "customers"); ok || err != nil {
		return err
	}
	rows := []domain.Customer{
		{ID: "C-001", Name: "Ama Mensah", Email: "ama@ameximports.com", Company: "Amex Importers", City: "Lagos", Currency: "NGN", Requests: 6, PipelineValue: 12_400_000, Joined: "Apr 2025", Status: domain.CustomerActive},
		{ID: "C-002", Name: "David Green", Email: "demo@example.com", Company: "DG Commerce", City: "Accra", Currency: "GHS", Requests: 4, PipelineValue: 8_700_000, Joined: "Jan 2026", Status: domain.CustomerActive},
		{ID: "C-003", Name: "Ngozi Eze", Email: "ngozi@brightline.ng", Company: "Brightline Stores", City: "Abuja", Currency: "NGN", Requests: 8, PipelineValue: 19_300_000, Joined: "Mar 2024", Status: domain.CustomerActive},
		{ID: "C-004", Name: "Kwame Boateng", Email: "kwame@kbo.com.gh", City: "Kumasi", Currency: "GHS", Requests: 2, PipelineValue: 3_100_000, Joined: "Aug 2026", Status: domain.CustomerNew},
		{ID: "C-005", Name: "Blessing Adeyemi", Email: "blessing@solewave.ng", Company: "Solewave", City: "Lagos", Currency: "NGN", Requests: 5, PipelineValue: 6_800_000, Joined: "Nov 2025", Status: domain.CustomerAtRisk},
		{ID: "C-006", Name: "Farida Suleiman", Email: "farida@zawadi.com", City: "Dar es Salaam", Currency: "TZS", Requests: 1, PipelineValue: 2_200_000, Joined: "Sep 2026", Status: domain.CustomerNew},
	}
	for _, c := range rows {
		_, err := db.Exec(
			`INSERT INTO customers (id, name, email, company, city, currency, requests, pipeline_value, joined, status)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			c.ID, c.Name, c.Email, c.Company, c.City, c.Currency, c.Requests, c.PipelineValue, c.Joined, c.Status,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) seedSuppliers() error {
	if ok, err := seeded(db, "suppliers"); ok || err != nil {
		return err
	}
	rows := []domain.Supplier{
		{ID: "SUP-001", Name: "Jiangsu Xinhe Leather Co.", City: "Wenzhou", Country: "China", Category: "Handbags & leather", Reliability: 96, LeadDays: "18–24 days", MOQ: "200 units", ContactEmail: "export@xinhe-leather.cn", ContactPhone: "+86 577 8652 1180", PaymentTerms: "30% deposit, 70% against B/L", Products: []string{"Structured handbags", "Cross-body bags", "PU & real leather goods"}, Notes: "Long-term partner. Two verifications passed; packaging issue on ORD-1188 resolved with a credit note.", Requests: 14, Since: "2021", Status: domain.SupplierVerified},
		{ID: "SUP-002", Name: "Shenzhen AmpCore Electronics", City: "Shenzhen", Country: "China", Category: "Consumer electronics", Reliability: 92, LeadDays: "12–16 days", MOQ: "100 units", ContactEmail: "sales@ampcore-sz.com", ContactPhone: "+86 755 2938 7714", PaymentTerms: "T/T 50% deposit, 50% before dispatch", Products: []string{"Smart watches", "Wireless headphones", "Bluetooth speakers"}, Notes: "Fast turnaround; certificates supplied with every PO. Prefers sea freight to keep landed cost down.", Requests: 9, Since: "2020", Status: domain.SupplierVerified},
		{ID: "SUP-003", Name: "Pantarlih Shoe Works", City: "Cibaduyut", Country: "Indonesia", Category: "Footwear", Reliability: 88, LeadDays: "21–28 days", MOQ: "500 units", ContactEmail: "export@pantarlih.co.id", ContactPhone: "+62 22 756 3301", PaymentTerms: "40% deposit, 60% after pre-shipment inspection", Products: []string{"Lifestyle sneakers", "Leather loafers", "Kids footwear"}, Notes: "Sneaker specialist. Consistent sizing runs; inspect every batch before loading.", Requests: 6, Since: "2022", Status: domain.SupplierVerified},
		{ID: "SUP-004", Name: "Lagos Ceramics & Tableware", City: "Ikorodu", Country: "Nigeria", Category: "Home & kitchen", Reliability: 84, LeadDays: "10–14 days", MOQ: "100 sets", ContactEmail: "info@lagosceramics.ng", ContactPhone: "+234 802 771 4405", PaymentTerms: "50% advance, 50% on delivery", Products: []string{"Stoneware dinner sets", "Ceramic mugs", "Serving platters"}, Notes: "Local option used to shorten freight time. Business licence still under verification.", Requests: 5, Since: "2021", Status: domain.SupplierPending},
		{ID: "SUP-005", Name: "Dhaka Knitwear Collective", City: "Dhaka", Country: "Bangladesh", Category: "Textiles & apparel", Reliability: 90, LeadDays: "16–22 days", MOQ: "300 units", ContactEmail: "export@dkknitwear.bd", ContactPhone: "+880 1712 445 902", PaymentTerms: "30% deposit, 70% against B/L", Products: []string{"Crew-neck tees", "Hoodies", "Polo shirts"}, Notes: "Strong wash-test compliance. Certificates need to accompany every shipment.", Requests: 8, Since: "2019", Status: domain.SupplierVerified},
		{ID: "SUP-006", Name: "Guangzhou Hanmor Lighting", City: "Foshan", Country: "China", Category: "Home & lighting", Reliability: 76, LeadDays: "14–20 days", MOQ: "150 units", ContactEmail: "export@hanmor-lighting.cn", ContactPhone: "+86 757 8339 1002", PaymentTerms: "T/T 40% deposit, 60% before dispatch", Products: []string{"LED desk lamps", "Architectural lighting", "Smart bulbs"}, Notes: "SHIP-1068 ran late on the delayed freight slot. Escalating; verify packaging tolerance before next PO.", Requests: 4, Since: "2023", Status: domain.SupplierAtRisk},
	}
	for _, s := range rows {
		products, err := json.Marshal(s.Products)
		if err != nil {
			return err
		}
		_, err = db.Exec(
			`INSERT INTO suppliers (id, name, city, country, category, reliability, lead_days, moq, contact_email, contact_phone, payment_terms, products_json, notes, requests, since, status)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			s.ID, s.Name, s.City, s.Country, s.Category, s.Reliability, s.LeadDays, s.MOQ,
			s.ContactEmail, s.ContactPhone, s.PaymentTerms, string(products), s.Notes,
			s.Requests, s.Since, s.Status,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) seedShipments() error {
	if ok, err := seeded(db, "shipments"); ok || err != nil {
		return err
	}
	rows := []domain.Shipment{
		{ID: "SHIP-1081", RequestID: "REQ-1030", Product: "Sneakers", Customer: "David Green", Supplier: "Pantarlih Shoe Works", Carrier: "MSC", Mode: "LCL", Origin: "Shenzhen, CN", Destination: "Tema, GH", ContainerRef: "MSCU-882104", DepartedAt: "Jul 2, 2026", ETA: "Jul 18, 2026", Status: domain.ShipmentInTransit},
		{ID: "SHIP-1079", RequestID: "REQ-0998", Product: "Ceramic Dinner Sets", Customer: "Ngozi Eze", Supplier: "Lagos Ceramics & Tableware", Carrier: "Maersk", Mode: "FCL", Origin: "Ningbo, CN", Destination: "Lagos, NG", ContainerRef: "MAEU-556011", DepartedAt: "Jun 19, 2026", ETA: "Jul 5, 2026", Status: domain.ShipmentCustoms},
		{ID: "SHIP-1072", RequestID: "REQ-1024", Product: "Smart Watches", Customer: "Ngozi Eze", Supplier: "Shenzhen AmpCore Electronics", Carrier: "DHL Aviation", Mode: "Air", Origin: "Shenzhen, CN", Destination: "Lagos, NG", ContainerRef: "DHL-AW-2208", DepartedAt: "Jul 3, 2026", DeliveredAt: "Jul 12, 2026", Status: domain.ShipmentDelivered},
		{ID: "SHIP-1086", RequestID: "REQ-1047", Product: "Wireless Headphones", Customer: "David Green", Supplier: "Shenzhen AmpCore Electronics", Carrier: "Maersk", Mode: "LCL", Origin: "Shenzhen, CN", Destination: "Accra, GH", ContainerRef: "MAEU-331774", ETA: "Aug 2, 2026", Status: domain.ShipmentBooked},
		{ID: "SHIP-1068", RequestID: "REQ-1009", Product: "LED Desk Lamps", Customer: "Kwame Boateng", Supplier: "Guangzhou Hanmor Lighting", Carrier: "CMA CGM", Mode: "FCL", Origin: "Foshan, CN", Destination: "Tema, GH", ContainerRef: "CMDU-718552", DepartedAt: "Jun 27, 2026", ETA: "Jul 24, 2026", Status: domain.ShipmentDelayed},
		{ID: "SHIP-1088", RequestID: "REQ-1011", Product: "Men’s T-Shirts", Customer: "Blessing Adeyemi", Supplier: "Dhaka Knitwear Collective", Carrier: "Hyundai GD", Mode: "LCL", Origin: "Chittagong, BD", Destination: "Lagos, NG", ContainerRef: "HDMU-940113", DepartedAt: "Jun 5, 2026", DeliveredAt: "Jun 28, 2026", Status: domain.ShipmentDelivered},
		{ID: "SHIP-1083", RequestID: "REQ-1036", Product: "Handbags", Customer: "Ama Mensah", Supplier: "Jiangsu Xinhe Leather Co.", Carrier: "COSCO", Mode: "FCL", Origin: "Wenzhou, CN", Destination: "Apapa, NG", ContainerRef: "COSU-204566", DepartedAt: "Jun 26, 2026", ETA: "Jul 16, 2026", Status: domain.ShipmentInTransit},
	}
	for _, s := range rows {
		_, err := db.Exec(
			`INSERT INTO shipments (id, request_id, product, customer, supplier, carrier, mode, origin, destination, container_ref, departed_at, eta, delivered_at, status)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			s.ID, s.RequestID, s.Product, s.Customer, s.Supplier, s.Carrier, s.Mode, s.Origin,
			s.Destination, s.ContainerRef, s.DepartedAt, s.ETA, s.DeliveredAt, s.Status,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) seedThreads() error {
	if ok, err := seeded(db, "threads"); ok || err != nil {
		return err
	}
	rows := []domain.Thread{
		{ID: "TH-001", Customer: "Ama Mensah", Email: "ama@ameximporters.com", Subject: "Handbags order — payment timing", Ref: "CHAT-0212", Unread: 2, Status: domain.ThreadNeedsReply, LastActive: "9m ago", Messages: []domain.ThreadMessage{
			{ID: "TH001-1", From: "customer", Author: "Ama Mensah", Text: "Hi — my quote for the handbags is approved, but I’d like to split payment across two tranches. Is that possible?", At: "Today, 8:02"},
			{ID: "TH001-2", From: "staff", Author: "Ada Okafor", Text: "Absolutely, Ama. We can take 40% now and 60% before departure. I’ll set that up on the quote.", At: "Today, 8:20"},
			{ID: "TH001-3", From: "customer", Author: "Ama Mensah", Text: "Perfect, thanks! Also, any update on the Apapa customs slip for our last shipment?", At: "Today, 10:34"},
			{ID: "TH001-4", From: "customer", Author: "Ama Mensah", Text: "Just checking in — scheduled to clear by Friday?", At: "Today, 11:02"},
		}},
		{ID: "TH-002", Customer: "David Green", Email: "david@dgcommerce.com", Subject: "Sneakers — size-run verification", Ref: "REQ-1030", Unread: 0, CustomerUnread: 1, Status: domain.ThreadResolved, LastActive: "2d ago", Messages: []domain.ThreadMessage{
			{ID: "TH002-1", From: "customer", Author: "David Green", Text: "Before we commit, can you verify the full size run is manufactured in the same factory?", At: "Mon, 9:12"},
			{ID: "TH002-2", From: "staff", Author: "Tunde Bello", Text: "Confirmed — the full 8-size run comes off the same line at Pantarlih. Audit photos attached to the request.", At: "Mon, 9:41"},
			{ID: "TH002-3", From: "customer", Author: "David Green", Text: "Great, that clears it. Proceed with the order.", At: "Mon, 10:05"},
		}},
		{ID: "TH-003", Customer: "Ngozi Eze", Email: "ngozi@brightlinestores.com", Subject: "Dinner-set MOQ question", Ref: "REQ-0998", Unread: 1, Status: domain.ThreadOpen, LastActive: "34m ago", Messages: []domain.ThreadMessage{
			{ID: "TH003-1", From: "customer", Author: "Ngozi Eze", Text: "What’s the minimum order for the ceramic dinner sets? Our Lagos store wants a smaller pilot run first.", At: "Today, 9:47"},
		}},
		{ID: "TH-004", Customer: "Kwame Boateng", Email: "kwame.boateng@gmail.com", Subject: "LED lamp shipping costs seem high", Ref: "REQ-1009", Unread: 0, Status: domain.ThreadResolved, LastActive: "4d ago", Messages: []domain.ThreadMessage{
			{ID: "TH004-1", From: "customer", Author: "Kwame Boateng", Text: "The freight estimate looks steep for Tema. Can we re-route through LCL instead of FCL?", At: "Fri, 14:20"},
			{ID: "TH004-2", From: "staff", Author: "Chioma Eze", Text: "Done — we’ve switched the quote to LCL and dropped the estimate by about 18%. Same ETA window.", At: "Fri, 15:03"},
			{ID: "TH004-3", From: "customer", Author: "Kwame Boateng", Text: "Much better, thanks Chioma.", At: "Fri, 15:22"},
		}},
		{ID: "TH-005", Customer: "Blessing Adeyemi", Email: "blessing@solewave.africa", Subject: "T-shirt supplier capacity", Ref: "REQ-1011", Unread: 1, Status: domain.ThreadNeedsReply, LastActive: "2h ago", Messages: []domain.ThreadMessage{
			{ID: "TH005-1", From: "customer", Author: "Blessing Adeyemi", Text: "Can the Dhaka collective handle a 15k drop before peak season, or should we split across two suppliers?", At: "Today, 6:18"},
		}},
	}
	for _, t := range rows {
		messages, err := json.Marshal(t.Messages)
		if err != nil {
			return err
		}
		_, err = db.Exec(
			`INSERT INTO threads (id, customer, email, subject, ref, unread, customer_unread, status, last_active, messages)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			t.ID, t.Customer, t.Email, t.Subject, t.Ref, t.Unread, t.CustomerUnread, t.Status, t.LastActive, string(messages),
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) seedQuotes() error {
	if ok, err := seeded(db, "quotes"); ok || err != nil {
		return err
	}
	rows := []domain.Quote{
		{ID: "QT-2041", RequestID: "REQ-1036", Product: "Handbags", Customer: "Ama Mensah", Supplier: "Shenzhen Mehr Leather Co.", ValueUSD: 13_420, MarginBps: 420, Status: domain.QuotePending, IssuedAt: "Sep 20, 2026", ExpiresAt: "Oct 4, 2026"},
		{ID: "QT-2042", RequestID: "REQ-1047", Product: "Wireless Headphones", Customer: "David Green", Supplier: "Shenzhen AmpCore Electronics", ValueUSD: 12_400, MarginBps: 450, Status: domain.QuotePending, IssuedAt: "Sep 23, 2026", ExpiresAt: "Oct 7, 2026"},
		{ID: "QT-2038", RequestID: "REQ-1030", Product: "Sneakers", Customer: "David Green", Supplier: "Yiwu StepOne Footwear", ValueUSD: 21_800, MarginBps: 380, Status: domain.QuoteApproved, IssuedAt: "Sep 12, 2026", ExpiresAt: "Sep 26, 2026"},
		{ID: "QT-2032", RequestID: "REQ-1024", Product: "Smart Watches", Customer: "Ngozi Eze", Supplier: "Dongguan TimeTech Ltd.", ValueUSD: 6_900, MarginBps: 460, Status: domain.QuoteSent, IssuedAt: "Sep 16, 2026", ExpiresAt: "Sep 30, 2026"},
		{ID: "QT-2029", RequestID: "REQ-1011", Product: "Men’s T-Shirts", Customer: "Blessing Adeyemi", Supplier: "Ningbo CottonCo", ValueUSD: 9_400, MarginBps: 620, Status: domain.QuoteDeclined, IssuedAt: "Aug 30, 2026", ExpiresAt: "Sep 13, 2026"},
		{ID: "QT-2022", RequestID: "REQ-1009", Product: "LED Desk Lamps", Customer: "Kwame Boateng", Supplier: "Foshan BrightLite", ValueUSD: 5_200, MarginBps: 540, Status: domain.QuoteDraft, IssuedAt: "Sep 18, 2026", ExpiresAt: "—"},
		{ID: "QT-2017", RequestID: "REQ-0998", Product: "Ceramic Dinner Sets", Customer: "Ngozi Eze", Supplier: "Huaian Tableware Co.", ValueUSD: 14_600, MarginBps: 500, Status: domain.QuoteExpired, IssuedAt: "Aug 20, 2026", ExpiresAt: "Sep 3, 2026"},
	}
	for _, q := range rows {
		if err := db.InsertQuote(q); err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) seedActivity() error {
	if ok, err := seeded(db, "activity"); ok || err != nil {
		return err
	}
	rows := []domain.Activity{
		{ID: "a1", Actor: "Ada Okafor", Action: "uploaded a supplier quote for", Target: "Winter Handbags", RequestID: "REQ-1036", At: "12 min ago", Tone: domain.ToneAccent},
		{ID: "a2", Actor: "Kwame Boateng", Action: "submitted a new sourcing request for", Target: "LED Desk Lamps", RequestID: "REQ-1009", At: "34 min ago", Tone: domain.ToneInfo},
		{ID: "a3", Actor: "System", Action: "marked", Target: "SNEAKERS-001 order as shipped", At: "2 hours ago", Tone: domain.ToneSuccess},
		{ID: "a4", Actor: "Ngozi Eze", Action: "approved", Target: "Smart Watches quote", RequestID: "REQ-1024", At: "5 hours ago", Tone: domain.ToneSuccess},
		{ID: "a5", Actor: "Blessing Adeyemi", Action: "declined", Target: "Men’s T-Shirts quote", RequestID: "REQ-1011", At: "1 day ago", Tone: domain.ToneDanger},
		{ID: "a6", Actor: "Fayfort ops", Action: "resolved a customs query on", Target: "Ceramic Dinner Sets", RequestID: "REQ-0998", At: "2 days ago", Tone: domain.ToneInfo},
	}
	for _, a := range rows {
		if err := db.InsertActivity(a); err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) seedRequests() error {
	if ok, err := seeded(db, "sourcing_requests"); ok || err != nil {
		return err
	}
	rows := []domain.SourcingRequest{
		{ID: "REQ-1047", Product: "Wireless Headphones", Category: "Electronics", Customer: "David Green", City: "Accra", Quantity: 500, Budget: 3_000_000, Currency: "NGN", Status: domain.RequestQuoteReady, Date: "Sep 22, 2026"},
		{ID: "REQ-1036", Product: "Handbags", Category: "Fashion", Customer: "Ama Mensah", City: "Lagos", Quantity: 300, Budget: 2_000_000, Currency: "NGN", Status: domain.RequestQuoteReady, Date: "Sep 18, 2026"},
		{ID: "REQ-1030", Product: "Sneakers", Category: "Footwear", Customer: "David Green", City: "Accra", Quantity: 1000, Budget: 4_000_000, Currency: "GHS", Status: domain.RequestConverted, Date: "Sep 10, 2026"},
		{ID: "REQ-1024", Product: "Smart Watches", Category: "Electronics", Customer: "Ngozi Eze", City: "Abuja", Quantity: 200, Budget: 1_500_000, Currency: "NGN", Status: domain.RequestConverted, Date: "Sep 16, 2026"},
		{ID: "REQ-1011", Product: "Men’s T-Shirts", Category: "Apparel", Customer: "Blessing Adeyemi", City: "Lagos", Quantity: 500, Budget: 2_500_000, Currency: "NGN", Status: domain.RequestClosed, Date: "Aug 28, 2026"},
		{ID: "REQ-1009", Product: "LED Desk Lamps", Category: "Home", Customer: "Kwame Boateng", City: "Kumasi", Quantity: 800, Budget: 5_800_000, Currency: "GHS", Status: domain.RequestSubmitted, Date: "Sep 23, 2026"},
		{ID: "REQ-0998", Product: "Ceramic Dinner Sets", Category: "Home", Customer: "Ngozi Eze", City: "Abuja", Quantity: 1500, Budget: 7_200_000, Currency: "NGN", Status: domain.RequestCompleted, Date: "Aug 14, 2026"},
	}
	for _, r := range rows {
		if err := db.InsertRequest(r); err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) seedAdminNotifications() error {
	if ok, err := seeded(db, "admin_notifications"); ok || err != nil {
		return err
	}
	rows := []domain.AdminNotification{
		{ID: "AN-901", Kind: "request", Message: "New sourcing request received: Wireless Headphones (David Green).", Time: "4m ago", Read: false, Href: "/admin/requests/REQ-1047"},
		{ID: "AN-900", Kind: "quote", Message: "Ama Mensah accepted quote QT-2041 — payment split requested.", Time: "18m ago", Read: false, Href: "/admin/orders/ORD-1216"},
		{ID: "AN-899", Kind: "inspection", Message: "INS-4053 requires your attention — defect re-run awaiting clearance.", Time: "1h ago", Read: false, Href: "/admin/inspections/INS-4053"},
		{ID: "AN-898", Kind: "shipment", Message: "SHIP-1068 (LED Desk Lamps) is now delayed — ETA Jul 24.", Time: "3h ago", Read: true, Href: "/admin/shipments/SHIP-1068"},
		{ID: "AN-896", Kind: "customer", Message: "Blessing Adeyemi submitted additional information on REQ-1011.", Time: "5h ago", Read: true, Href: "/admin/requests/REQ-1011"},
		{ID: "AN-895", Kind: "request", Message: "New sourcing request received: Wireless Headphones (David Green).", Time: "1d ago", Read: true, Href: "/admin/requests/REQ-1047"},
		{ID: "AN-894", Kind: "shipment", Message: "SHIP-1083 (Handbags) cleared origin and is now in transit.", Time: "Jun 26, 2026", Read: true, Href: "/admin/shipments/SHIP-1083"},
	}
	for _, n := range rows {
		read := 0
		if n.Read {
			read = 1
		}
		_, err := db.Exec(
			`INSERT INTO admin_notifications (id, kind, message, time, read, href) VALUES (?, ?, ?, ?, ?, ?)`,
			n.ID, n.Kind, n.Message, n.Time, read, n.Href,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) seedCustomerNotifications() error {
	if ok, err := seeded(db, "customer_notifications"); ok || err != nil {
		return err
	}
	rows := []domain.CustomerNotification{
		{ID: "n1", Title: "Wireless Headphones — In Review", Body: "Our sourcing team has picked up your request and is reviewing the brief.", At: "2 min ago", Read: false, RequestID: "REQ-1047"},
		{ID: "n2", Title: "Handbags — quote ready", Body: "A quote is waiting for you over on My Requests.", At: "1 hour ago", Read: false, RequestID: "REQ-1036"},
		{ID: "n3", Title: "Sneakers — converted", Body: "Your request was confirmed and has become an active order.", At: "2 days ago", Read: true, RequestID: "REQ-1030"},
		{ID: "n4", Title: "Welcome to the portal", Body: "Track requests, chat with the team and check estimates here.", At: "Sep 20", Read: true},
	}
	for _, n := range rows {
		read := 0
		if n.Read {
			read = 1
		}
		_, err := db.Exec(
			`INSERT INTO customer_notifications (id, title, body, at, read, request_id) VALUES (?, ?, ?, ?, ?, ?)`,
			n.ID, n.Title, n.Body, n.At, read, n.RequestID,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) seedOrders() error {
	if ok, err := seeded(db, "orders"); ok || err != nil {
		return err
	}
	rows := []domain.Order{
		{ID: "ORD-1204", RequestID: "REQ-1030", Customer: "David Green", Product: "Sneakers", Supplier: "Pantarlih Shoe Works", Quantity: 1200, UnitPriceUSD: 7.5, ValueUSD: 9000, Status: domain.OrderShipping, Date: "Jun 26, 2026", ETA: "Jul 18, 2026"},
		{ID: "ORD-1211", RequestID: "REQ-1024", Customer: "Ngozi Eze", Product: "Smart Watches", Supplier: "Shenzhen AmpCore Electronics", Quantity: 800, UnitPriceUSD: 18.4, ValueUSD: 14720, Status: domain.OrderDelivered, Date: "Jun 18, 2026", ETA: "Jul 12, 2026"},
		{ID: "ORD-1188", RequestID: "REQ-1011", Customer: "Blessing Adeyemi", Product: "Men’s T-Shirts", Supplier: "Dhaka Knitwear Collective", Quantity: 10000, UnitPriceUSD: 2.35, ValueUSD: 23500, Status: domain.OrderDelivered, Date: "May 29, 2026", ETA: "Jun 28, 2026"},
		{ID: "ORD-1197", RequestID: "REQ-0998", Customer: "Ngozi Eze", Product: "Ceramic Dinner Sets", Supplier: "Lagos Ceramics & Tableware", Quantity: 1500, UnitPriceUSD: 11.2, ValueUSD: 16800, Status: domain.OrderSupplierProcessing, Date: "Jun 12, 2026", ETA: "Jul 16, 2026"},
		{ID: "ORD-1209", RequestID: "REQ-1009", Customer: "Kwame Boateng", Product: "LED Desk Lamps", Supplier: "Guangzhou Hanmor Lighting", Quantity: 2000, UnitPriceUSD: 6.1, ValueUSD: 12200, Status: domain.OrderInspection, Date: "Jun 20, 2026", ETA: "Jul 24, 2026"},
		{ID: "ORD-1216", RequestID: "REQ-1036", Customer: "Ama Mensah", Product: "Handbags", Supplier: "Jiangsu Xinhe Leather Co.", Quantity: 300, UnitPriceUSD: 21.6, ValueUSD: 6480, Status: domain.OrderWarehouse, Date: "Jun 30, 2026", ETA: "Jul 20, 2026"},
		{ID: "ORD-1193", RequestID: "REQ-1047", Customer: "David Green", Product: "Wireless Headphones", Supplier: "Shenzhen AmpCore Electronics", Quantity: 500, UnitPriceUSD: 17.9, ValueUSD: 8950, Status: domain.OrderPayment, Date: "Jul 3, 2026", ETA: "Aug 2, 2026"},
	}
	for _, o := range rows {
		_, err := db.Exec(
			`INSERT INTO orders (id, request_id, customer, product, supplier, quantity, unit_price_usd, value_usd, status, date, eta)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			o.ID, o.RequestID, o.Customer, o.Product, o.Supplier, o.Quantity, o.UnitPriceUSD,
			o.ValueUSD, o.Status, o.Date, o.ETA,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) seedInspections() error {
	if ok, err := seeded(db, "inspections"); ok || err != nil {
		return err
	}
	rows := []domain.Inspection{
		{ID: "INS-4053", OrderID: "ORD-1209", Customer: "Kwame Boateng", Supplier: "Guangzhou Hanmor Lighting", Product: "LED Desk Lamps", Quantity: 2000, Status: domain.InspectionInProgress, ScheduledAt: "Jul 3, 2026", Inspector: "Chioma Eze"},
		{ID: "INS-4041", OrderID: "ORD-1197", Customer: "Ngozi Eze", Supplier: "Lagos Ceramics & Tableware", Product: "Ceramic Dinner Sets", Quantity: 1500, Status: domain.InspectionPending, ScheduledAt: "Jul 8, 2026", Inspector: "Tunde Bello"},
		{ID: "INS-4036", OrderID: "ORD-1188", Customer: "Blessing Adeyemi", Supplier: "Dhaka Knitwear Collective", Product: "Men’s T-Shirts", Quantity: 10000, Status: domain.InspectionPassed, ScheduledAt: "Jun 20, 2026", Inspector: "Ada Okafor", Notes: "Batch sampled across colourways — stitch quality within spec."},
		{ID: "INS-4029", OrderID: "ORD-1193", Customer: "David Green", Supplier: "Shenzhen AmpCore Electronics", Product: "Wireless Headphones", Quantity: 500, Status: domain.InspectionPending, ScheduledAt: "Jul 12, 2026", Inspector: "Yara Koné"},
		{ID: "INS-4022", OrderID: "ORD-1204", Customer: "David Green", Supplier: "Pantarlih Shoe Works", Product: "Sneakers", Quantity: 1200, Status: domain.InspectionIssues, ScheduledAt: "Jun 26, 2026", Inspector: "Tunde Bello", Notes: "Discoloured pairs found in size 42 batch — supplier is re-running that run."},
		{ID: "INS-4028", OrderID: "ORD-1216", Customer: "Ama Mensah", Supplier: "Jiangsu Xinhe Leather Co.", Product: "Handbags", Quantity: 300, Status: domain.InspectionPending, ScheduledAt: "Jul 9, 2026", Inspector: "Chioma Eze"},
		{ID: "INS-4011", OrderID: "ORD-1211", Customer: "Ngozi Eze", Supplier: "Shenzhen AmpCore Electronics", Product: "Smart Watches", Quantity: 800, Status: domain.InspectionCompleted, ScheduledAt: "Jun 30, 2026", Inspector: "Ada Okafor", Notes: "All units tested, packaging reinforced, cleared for shipment."},
	}
	for _, i := range rows {
		_, err := db.Exec(
			`INSERT INTO inspections (id, order_id, customer, supplier, product, quantity, status, scheduled_at, inspector, notes)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			i.ID, i.OrderID, i.Customer, i.Supplier, i.Product, i.Quantity, i.Status,
			i.ScheduledAt, i.Inspector, i.Notes,
		)
		if err != nil {
			return err
		}
	}
	return nil
}
