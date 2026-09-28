package domain

import "math"

// TransportMode mirrors estimate.ts TransportMode.
type TransportMode string

const (
	ModeLCL TransportMode = "lcl"
	ModeFCL TransportMode = "fcl"
	ModeAir TransportMode = "air"
)

// ReferenceRates mirrors estimate.ts REFERENCE_RATES.
var ReferenceRates = struct {
	PackagingFeePct  float64
	PackagingFeeMin  float64
	InsurancePct     float64
	InspectionFee    float64
	ClearingSea      float64
	ClearingAir      float64
	FXContingencyPct float64
	ServiceFeePct    float64
	ServiceFeeMin    float64
	Freight          struct {
		LCLPerCbm float64
		LCLDoor   float64
		FCLFixed  float64
		FCLDoor   float64
		AirPerKg  float64
		AirDoor   float64
	}
}{
	PackagingFeePct:  0.03,
	PackagingFeeMin:  25,
	InsurancePct:     0.005,
	InspectionFee:    150,
	ClearingSea:      120,
	ClearingAir:      90,
	FXContingencyPct: 0.015,
	ServiceFeePct:    0.075,
	ServiceFeeMin:    40,
}

func init() {
	ReferenceRates.Freight.LCLPerCbm = 45
	ReferenceRates.Freight.LCLDoor = 150
	ReferenceRates.Freight.FCLFixed = 1450
	ReferenceRates.Freight.FCLDoor = 200
	ReferenceRates.Freight.AirPerKg = 4.2
	ReferenceRates.Freight.AirDoor = 60
}

// ReferenceFxPerUSD mirrors estimate.ts REFERENCE_FX_PER_USD: units of foreign
// currency per 1 USD.
var ReferenceFxPerUSD = map[string]float64{
	"USD": 1, "CNY": 7.2, "NGN": 1500, "KES": 130, "GHS": 15.8,
	"ZAR": 18.5, "UGX": 3700, "TZS": 2650, "EUR": 0.92, "GBP": 0.79,
}

// ReferenceFxNGNPerUSD is the demo naira-per-USD figure used on result pages.
const ReferenceFxNGNPerUSD = 1500

// ToUSD converts an amount in the given currency into USD using the reference table.
func ToUSD(amount float64, currency string) float64 {
	rate, ok := ReferenceFxPerUSD[currency]
	if !ok || rate <= 0 {
		return amount
	}
	return amount / rate
}

// EstimateInput mirrors EstimateInput.
type EstimateInput struct {
	UnitCostUSD        float64       `json:"unitCostUsd"`
	Quantity           int           `json:"quantity"`
	ShipmentWeightKg   float64       `json:"shipmentWeightKg"`
	ShipmentVolumeCbm  float64       `json:"shipmentVolumeCbm"`
	TransportMode      TransportMode `json:"transportMode"`
	DoorDelivery       bool          `json:"doorDelivery"`
	DutyRate           float64       `json:"dutyRate"`
	InspectionIncluded bool          `json:"inspectionIncluded"`
	InspectionCostUSD  float64       `json:"inspectionCostUsd,omitempty"`
	PackagingCostUSD   float64       `json:"packagingCostUsd,omitempty"`
	AgentFeeUSD        float64       `json:"agentFeeUsd,omitempty"`
	OtherCostUSD       float64       `json:"otherCostUsd,omitempty"`
}

// CostLine mirrors CostLine.
type CostLine struct {
	Key    string  `json:"key"`
	Label  string  `json:"label"`
	Amount float64 `json:"amountUsd"`
}

// EstimateResult mirrors EstimateResult.
type EstimateResult struct {
	Lines                 []CostLine `json:"lines"`
	SubtotalBeforeService float64    `json:"subtotalBeforeServiceUsd"`
	ServiceFee            float64    `json:"serviceFeeUsd"`
	Total                 float64    `json:"totalUsd"`
}

// SimplifiedEstimate mirrors SimplifiedEstimate.
type SimplifiedEstimate struct {
	Result          EstimateResult `json:"result"`
	WeightKG        float64        `json:"weightKg"`
	VolumeCBM       float64        `json:"volumeCbm"`
	WeightDefaulted bool           `json:"weightDefaulted"`
	VolumeDefaulted bool           `json:"volumeDefaulted"`
	DutyRate        float64        `json:"dutyRate"`
}

const (
	defaultUnitWeightKG  = 0.5
	defaultUnitVolumeCBM = 0.01
	defaultDutyRate      = 0.12
)

func finitePositive(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) && v > 0 }

// ComputeEstimate mirrors computeEstimate. Returns nil when the input is unusable.
func ComputeEstimate(in *EstimateInput) *EstimateResult {
	if in == nil ||
		!finitePositive(in.UnitCostUSD) ||
		in.Quantity < 1 ||
		!finitePositive(in.ShipmentWeightKg) ||
		in.DutyRate < 0 ||
		(in.TransportMode == ModeLCL && !finitePositive(in.ShipmentVolumeCbm)) {
		return nil
	}
	r := ReferenceRates
	productTotal := in.UnitCostUSD * float64(in.Quantity)
	freight := freightUSD(in)
	insurance := productTotal * r.InsurancePct
	packaging := r.PackagingFeeMin
	if finitePositive(in.PackagingCostUSD) {
		packaging = in.PackagingCostUSD
	} else {
		if v := productTotal * r.PackagingFeePct; v > packaging {
			packaging = v
		}
	}
	duty := (productTotal + freight + insurance) * in.DutyRate
	clearance := r.ClearingSea
	if in.TransportMode == ModeAir {
		clearance = r.ClearingAir
	}
	inspection := 0.0
	if finitePositive(in.InspectionCostUSD) {
		inspection = in.InspectionCostUSD
	} else if in.InspectionIncluded {
		inspection = r.InspectionFee
	}

	lines := []CostLine{
		{Key: "product", Label: "Product cost", Amount: productTotal},
		{Key: "freight", Label: "International freight & local delivery", Amount: freight},
		{Key: "insurance", Label: "Cargo insurance", Amount: insurance},
		{Key: "packaging", Label: "Supplier & packaging fees", Amount: packaging},
		{Key: "duty", Label: "Customs duty & taxes", Amount: duty},
		{Key: "clearance", Label: "Clearance & customs handling", Amount: clearance},
	}
	if inspection > 0 {
		lines = append(lines, CostLine{Key: "inspection", Label: "Quality inspection", Amount: inspection})
	}
	fxBuffer := (productTotal + freight + insurance + packaging + duty + clearance) * r.FXContingencyPct
	lines = append(lines, CostLine{Key: "fx", Label: "FX & contingency buffer", Amount: fxBuffer})

	subtotal := 0.0
	for _, line := range lines {
		subtotal += line.Amount
	}
	serviceFee := r.ServiceFeeMin
	if v := productTotal * r.ServiceFeePct; v > serviceFee {
		serviceFee = v
	}

	optional := []CostLine{}
	if finitePositive(in.AgentFeeUSD) {
		optional = append(optional, CostLine{Key: "agent-fee", Label: "Agent / service fee", Amount: in.AgentFeeUSD})
	}
	if finitePositive(in.OtherCostUSD) {
		optional = append(optional, CostLine{Key: "other", Label: "Other costs", Amount: in.OtherCostUSD})
	}

	lines = append(lines, optional...)
	lines = append(lines, CostLine{Key: "service", Label: "Fayfort sourcing fee", Amount: serviceFee})

	optionalTotal := 0.0
	for _, line := range optional {
		optionalTotal += line.Amount
	}
	return &EstimateResult{
		Lines:                 lines,
		SubtotalBeforeService: subtotal,
		ServiceFee:            serviceFee,
		Total:                 subtotal + optionalTotal + serviceFee,
	}
}

func freightUSD(in *EstimateInput) float64 {
	r := ReferenceRates
	door := map[TransportMode]float64{ModeLCL: r.Freight.LCLDoor, ModeFCL: r.Freight.FCLDoor, ModeAir: r.Freight.AirDoor}[in.TransportMode]
	if !in.DoorDelivery {
		door = 0
	}
	switch in.TransportMode {
	case ModeAir:
		return in.ShipmentWeightKg*r.Freight.AirPerKg + door
	case ModeFCL:
		return r.Freight.FCLFixed + door
	default: // lcl
		return in.ShipmentVolumeCbm*r.Freight.LCLPerCbm + door
	}
}

// ComputeSimplifiedEstimate mirrors computeSimplifiedEstimate. Weight, volume and
// duty rate fall back to internal assumptions so the caller only needs what is known.
func ComputeSimplifiedEstimate(unitCostUSD float64, quantity int, mode TransportMode,
	weightKG, volumeCBM, dutyRate float64, doorDelivery *bool, inspectionIncluded bool) *SimplifiedEstimate {
	if !finitePositive(unitCostUSD) || quantity < 1 {
		return nil
	}
	if !(mode == ModeLCL || mode == ModeAir) {
		mode = ModeLCL
	}
	w := defaultUnitWeightKG * float64(quantity)
	if finitePositive(weightKG) {
		w = weightKG
	}
	v := defaultUnitVolumeCBM * float64(quantity)
	if finitePositive(volumeCBM) {
		v = volumeCBM
	}
	d := defaultDutyRate
	if finitePositive(dutyRate) {
		d = dutyRate
	}
	dd := true
	if doorDelivery != nil {
		dd = *doorDelivery
	}
	result := ComputeEstimate(&EstimateInput{
		UnitCostUSD:        unitCostUSD,
		Quantity:           quantity,
		ShipmentWeightKg:   w,
		ShipmentVolumeCbm:  v,
		TransportMode:      mode,
		DoorDelivery:       dd,
		DutyRate:           d,
		InspectionIncluded: inspectionIncluded,
	})
	if result == nil {
		return nil
	}
	return &SimplifiedEstimate{
		Result:          *result,
		WeightKG:        w,
		VolumeCBM:       v,
		WeightDefaulted: !finitePositive(weightKG),
		VolumeDefaulted: !finitePositive(volumeCBM),
		DutyRate:        d,
	}
}
