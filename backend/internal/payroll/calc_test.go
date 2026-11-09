package payroll

import "testing"

func same(b Bonus) (Bonus, Bonus) { return b, b }

func TestCalculate(t *testing.T) {
	ocMet, ocMissed := same(Bonus{Type: PerXSales, SalesPerBonus: 5, Amount: 100_000, Pct: 100})
	oneclick := Rule{BaseSalary: 1_500_000, Met: ocMet, Missed: ocMissed}

	jetnote := Rule{
		BaseSalary: 1_000_000,
		Met:        Bonus{Type: PerSale, SalesPerBonus: 1, Amount: 50_000, Pct: 100},
		Missed:     Bonus{Type: PerSale, SalesPerBonus: 1, Amount: 50_000, Pct: 50},
	}

	// Different bonus TYPE per outcome: per 5 sales when met, per sale when missed.
	mixed := Rule{
		BaseSalary: 1_000_000,
		Met:        Bonus{Type: PerXSales, SalesPerBonus: 5, Amount: 300_000, Pct: 100},
		Missed:     Bonus{Type: PerSale, SalesPerBonus: 1, Amount: 20_000, Pct: 50},
	}

	tests := []struct {
		name  string
		rule  Rule
		sales int
		met   bool
		want  int64
	}{
		{"oneclick 12 sales, target met", oneclick, 12, true, 1_700_000},   // 2 blocks × 100k + 1.5M
		{"oneclick 12 sales, target missed", oneclick, 12, false, 200_000}, // bonus only
		{"oneclick 4 sales, target met", oneclick, 4, true, 1_500_000},     // no full block yet
		{"jetnote 7 sales, target met", jetnote, 7, true, 1_350_000},
		{"jetnote 7 sales, missed at 50%", jetnote, 7, false, 175_000},
		{"no sales, missed", jetnote, 0, false, 0},
		{"mixed 12 sales, met uses per-5", mixed, 12, true, 1_600_000},      // 2 × 300k + 1M
		{"mixed 12 sales, missed uses per-sale", mixed, 12, false, 120_000}, // 12 × 20k × 50%
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Calculate(tt.rule, tt.sales, tt.met).Total
			if got != tt.want {
				t.Fatalf("got %d, want %d", got, tt.want)
			}
		})
	}
}

func TestValidate(t *testing.T) {
	ok := Bonus{Type: PerSale, SalesPerBonus: 1, Amount: 1, Pct: 100}
	bad := Bonus{Type: PerXSales, SalesPerBonus: 0, Amount: 1, Pct: 100}
	if err := (Rule{Met: ok, Missed: ok}).Validate(); err != nil {
		t.Fatalf("valid rule rejected: %v", err)
	}
	if err := (Rule{Met: ok, Missed: bad}).Validate(); err == nil {
		t.Fatal("expected error for missed bonus with 0 sales per bonus")
	}
}
