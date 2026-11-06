// backend/internal/payroll/calc_test.go
package payroll

import "testing"

func TestCalculate(t *testing.T) {
	oneclick := Rule{BaseSalary: 1_500_000, BonusType: PerXSales, SalesPerBonus: 5, BonusAmount: 100_000, PctTargetMet: 100, PctTargetMissed: 100}
	jetnote := Rule{BaseSalary: 1_000_000, BonusType: PerSale, SalesPerBonus: 1, BonusAmount: 50_000, PctTargetMet: 100, PctTargetMissed: 50}

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