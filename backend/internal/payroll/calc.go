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

// Bonus is how the bonus is counted for ONE outcome (target met or missed).
//
//	PER_SALE:     raw = sales × Amount
//	PER_X_SALES:  raw = floor(sales / SalesPerBonus) × Amount
//
// Pct% of raw is then paid out.
type Bonus struct {
	Type          string `json:"type"`
	SalesPerBonus int    `json:"salesPerBonus"`
	Amount        int64  `json:"amount"`
	Pct           int    `json:"pct"`
}

// Rule is a plain copy of a business's pay settings. It has no database or
// GraphQL dependencies, which makes the math trivial to unit-test.
type Rule struct {
	BaseSalary int64 `json:"baseSalary"`
	Met        Bonus `json:"targetMet"`
	Missed     Bonus `json:"targetMissed"`
}

type Result struct {
	BaseSalary int64 // 0 when the target was missed
	BonusRaw   int64 // bonus before applying the percentage
	BonusPct   int
	BonusFinal int64
	Total      int64
}

func (b Bonus) raw(sales int) int64 {
	if b.Type == PerXSales {
		if b.SalesPerBonus < 1 {
			return 0
		}
		return int64(sales/b.SalesPerBonus) * b.Amount // integer division = floor
	}
	return int64(sales) * b.Amount
}

// Calculate applies the business rules:
//   - target achieved:  base salary + "met" bonus × its %
//   - target missed:    "missed" bonus × its %   (no salary)
func Calculate(r Rule, sales int, targetAchieved bool) Result {
	b := r.Missed
	var res Result
	if targetAchieved {
		b = r.Met
		res.BaseSalary = r.BaseSalary
	}
	res.BonusRaw = b.raw(sales)
	res.BonusPct = b.Pct
	res.BonusFinal = res.BonusRaw * int64(b.Pct) / 100
	res.Total = res.BaseSalary + res.BonusFinal
	return res
}

func (b Bonus) validate(label string) error {
	switch {
	case b.Type != PerSale && b.Type != PerXSales:
		return fmt.Errorf("%s: bonus type must be PER_SALE or PER_X_SALES", label)
	case b.Type == PerXSales && b.SalesPerBonus < 1:
		return fmt.Errorf("%s: sales per bonus must be at least 1", label)
	case b.Amount < 0:
		return fmt.Errorf("%s: bonus amount cannot be negative", label)
	case b.Pct < 0 || b.Pct > 1000:
		return fmt.Errorf("%s: percentage must be between 0 and 1000", label)
	}
	return nil
}

func (r Rule) Validate() error {
	if r.BaseSalary < 0 {
		return errors.New("base salary cannot be negative")
	}
	if err := r.Met.validate("target achieved"); err != nil {
		return err
	}
	return r.Missed.validate("target missed")
}

func (b Bonus) summary() string {
	s := fmt.Sprintf("Rp%d per sale", b.Amount)
	if b.Type == PerXSales {
		s = fmt.Sprintf("Rp%d per %d sales", b.Amount, b.SalesPerBonus)
	}
	return fmt.Sprintf("%s at %d%%", s, b.Pct)
}

func (r Rule) Summary() string {
	return fmt.Sprintf("Target met: salary Rp%d + %s · Target missed: %s",
		r.BaseSalary, r.Met.summary(), r.Missed.summary())
}
