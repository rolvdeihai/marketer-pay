// backend/internal/payroll/calc.go
package payroll

import (
	"errors"
	"fmt"
)

const (
	PerSale   = "PER_SALE"
	PerXSales = "PER_X_SALES"
)

// Rule is a plain copy of a business's pay settings. It has no database or
// GraphQL dependencies, which makes the math trivial to unit-test.
type Rule struct {
	BaseSalary      int64  `json:"baseSalary"`
	BonusType       string `json:"bonusType"`
	SalesPerBonus   int    `json:"salesPerBonus"`
	BonusAmount     int64  `json:"bonusAmount"`
	PctTargetMet    int    `json:"pctTargetMet"`
	PctTargetMissed int    `json:"pctTargetMissed"`
}

type Result struct {
	BaseSalary int64 // 0 when the target was missed
	BonusRaw   int64 // bonus before applying the percentage
	BonusPct   int
	BonusFinal int64
	Total      int64
}

// Calculate applies the business rules:
//   - target achieved:  base salary + bonus × pctTargetMet%
//   - target missed:    bonus × pctTargetMissed%   (no salary)
func Calculate(r Rule, sales int, targetAchieved bool) Result {
	var raw int64
	switch r.BonusType {
	case PerXSales:
		if r.SalesPerBonus > 0 {
			raw = int64(sales/r.SalesPerBonus) * r.BonusAmount // integer division = floor
		}
	default: // PerSale
		raw = int64(sales) * r.BonusAmount
	}

	res := Result{BonusRaw: raw}
	if targetAchieved {
		res.BaseSalary = r.BaseSalary
		res.BonusPct = r.PctTargetMet
	} else {
		res.BonusPct = r.PctTargetMissed
	}
	res.BonusFinal = raw * int64(res.BonusPct) / 100
	res.Total = res.BaseSalary + res.BonusFinal
	return res
}

func (r Rule) Validate() error {
	switch {
	case r.BonusType != PerSale && r.BonusType != PerXSales:
		return errors.New("bonus type must be PER_SALE or PER_X_SALES")
	case r.BonusType == PerXSales && r.SalesPerBonus < 1:
		return errors.New("sales per bonus must be at least 1")
	case r.BaseSalary < 0 || r.BonusAmount < 0:
		return errors.New("amounts cannot be negative")
	case r.PctTargetMet < 0 || r.PctTargetMet > 1000 || r.PctTargetMissed < 0 || r.PctTargetMissed > 1000:
		return errors.New("percentages must be between 0 and 1000")
	}
	return nil
}

func (r Rule) Summary() string {
	bonus := fmt.Sprintf("Rp%d per sale", r.BonusAmount)
	if r.BonusType == PerXSales {
		bonus = fmt.Sprintf("Rp%d per %d sales", r.BonusAmount, r.SalesPerBonus)
	}
	return fmt.Sprintf("%s · salary Rp%d if target met · bonus %d%% if met / %d%% if missed",
		bonus, r.BaseSalary, r.PctTargetMet, r.PctTargetMissed)
}