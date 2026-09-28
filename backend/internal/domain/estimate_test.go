package domain

import (
	"math"
	"testing"
)

func TestComputeEstimate_Full(t *testing.T) {
	// Exact figures pinned by the frontend engine for the same inputs.
	in := &EstimateInput{
		UnitCostUSD:        10,
		Quantity:           1000,
		ShipmentWeightKg:   500,
		ShipmentVolumeCbm:  10,
		TransportMode:      ModeLCL,
		DoorDelivery:       true,
		DutyRate:           0.12,
		InspectionIncluded: true,
	}
	res := ComputeEstimate(in)
	if res == nil {
		t.Fatal("expected a non-nil estimate")
	}
	if res.Total <= 0 {
		t.Fatalf("expected positive total, got %v", res.Total)
	}
	// Sum of lines must include service fee.
	sum := 0.0
	for _, line := range res.Lines {
		if line.Amount <= 0 {
			t.Fatalf("line %s has non-positive amount %v", line.Key, line.Amount)
		}
		sum += line.Amount
	}
	if math.Abs(sum-res.Total) > 1e-6 {
		t.Fatalf("line sum %v != total %v", sum, res.Total)
	}
	// Manual recomputation for a couple of lines.
	product := 10.0 * 1000
	freight := 10*45.0 + 150.0 // lclPerCbm * cbm + door
	if got := res.Lines[1].Amount; math.Abs(got-freight) > 1e-9 {
		t.Fatalf("freight = %v, want %v", got, freight)
	}
	insurance := product * 0.005
	if got := res.Lines[2].Amount; math.Abs(got-insurance) > 1e-9 {
		t.Fatalf("insurance = %v, want %v", got, insurance)
	}
	packaging := math.Max(product*0.03, 25)
	if got := res.Lines[3].Amount; math.Abs(got-packaging) > 1e-9 {
		t.Fatalf("packaging = %v, want %v", got, packaging)
	}
	hasInspection := false
	for _, line := range res.Lines {
		if line.Key == "inspection" {
			hasInspection = true
			if line.Amount != 150 {
				t.Fatalf("inspection fee = %v, want 150", line.Amount)
			}
		}
	}
	if !hasInspection {
		t.Error("expected an inspection line when inspectionIncluded")
	}
}

func TestComputeEstimate_Invalid(t *testing.T) {
	cases := []*EstimateInput{
		nil,
		{UnitCostUSD: 0, Quantity: 5, ShipmentWeightKg: 1, TransportMode: ModeLCL, ShipmentVolumeCbm: 1},
		{UnitCostUSD: 2, Quantity: 0, ShipmentWeightKg: 1, TransportMode: ModeLCL, ShipmentVolumeCbm: 1},
		{UnitCostUSD: 2, Quantity: 5, ShipmentWeightKg: 0, TransportMode: ModeLCL, ShipmentVolumeCbm: 1},
		{UnitCostUSD: 2, Quantity: 5, ShipmentWeightKg: 1, TransportMode: ModeLCL, ShipmentVolumeCbm: 0, DutyRate: -1},
	}
	for i, in := range cases {
		if res := ComputeEstimate(in); res != nil {
			t.Errorf("case %d: expected nil, got %+v", i, res)
		}
	}
}

func TestComputeSimplifiedEstimate_Defaults(t *testing.T) {
	res := ComputeSimplifiedEstimate(10, 100, ModeLCL, 0, 0, 0, nil, true)
	if res == nil {
		t.Fatal("expected a result")
	}
	if !res.WeightDefaulted || !res.VolumeDefaulted {
		t.Error("defaulted flags should be true when inputs are absent")
	}
	if math.Abs(res.WeightKG-0.5*100) > 1e-9 {
		t.Errorf("weight = %v, want 50 (default 0.5kg/unit)", res.WeightKG)
	}
	if math.Abs(res.VolumeCBM-0.01*100) > 1e-9 {
		t.Errorf("volume = %v, want 1 (default 0.01cbm/unit)", res.VolumeCBM)
	}
	if math.Abs(res.DutyRate-0.12) > 1e-9 {
		t.Errorf("duty = %v, want 0.12", res.DutyRate)
	}
	if res.Result.Total <= 0 {
		t.Error("expected a positive total")
	}
}

func TestFormatNaira(t *testing.T) {
	if got := FormatNaira(12_400_000); got != "₦12,400,000" {
		t.Errorf("FormatNaira = %q", got)
	}
	if got := FormatNaira(1500); got != "₦1,500" {
		t.Errorf("FormatNaira = %q", got)
	}
	if got := FormatUSD(9000, 0); got != "$9,000" {
		t.Errorf("FormatUSD = %q", got)
	}
	if got := FormatUSD(1234.5, 2); got != "$1,234.50" {
		t.Errorf("FormatUSD(2) = %q", got)
	}
}

func TestTimelineFromStatus(t *testing.T) {
	got := TimelineFromStatus(RequestQuoteReady)
	want := []PortalTimelineStage{{"Submitted", "done"}, {"Quote", "active"}, {"Approved", "pending"}, {"Shipped", "pending"}}
	if len(got) != len(want) {
		t.Fatalf("len = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("stage %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestFilterRequests(t *testing.T) {
	reqs := []SourcingRequest{
		{ID: "REQ-1047", Product: "Wireless Headphones", Customer: "David Green", City: "Accra", Status: RequestUnderReview},
		{ID: "REQ-1036", Product: "Handbags", Customer: "Ama Mensah", City: "Lagos", Status: RequestQuoteReady},
	}
	status := RequestQuoteReady
	filtered := FilterRequests(reqs, &status, "")
	if len(filtered) != 1 || filtered[0].ID != "REQ-1036" {
		t.Fatalf("status filter got %+v", filtered)
	}
	filtered = FilterRequests(reqs, nil, "david")
	if len(filtered) != 1 || filtered[0].ID != "REQ-1047" {
		t.Fatalf("query filter got %+v", filtered)
	}
}

func TestShipmentTimeline(t *testing.T) {
	got := ShipmentTimelineFromStatus(ShipmentCustoms)
	if len(got) != 7 {
		t.Fatalf("len = %d, want 7", len(got))
	}
	if got[4].State != "active" {
		t.Errorf("customs stage state = %q, want active", got[4].State)
	}
	if got[5].State != "pending" {
		t.Errorf("out-for-delivery stage state = %q, want pending", got[5].State)
	}
	done := ShipmentTimelineFromStatus(ShipmentDelivered)
	if done[len(done)-1].State != "done" {
		t.Errorf("delivered final stage = %q, want done", done[len(done)-1].State)
	}
}
