// backend/graph/resolver.go
package graph

//go:generate go tool gqlgen generate

import (
	"context"
	"time"

	"marketerpay/graph/model"
	"marketerpay/internal/aiclient"
	"marketerpay/internal/cache"
	"marketerpay/internal/payroll"
	"marketerpay/internal/period"
	"marketerpay/internal/store"
)

// Resolver is the dependency container. main.go builds it once and every
// resolver method reaches the database, cache and AI client through it.
type Resolver struct {
	Store *store.Store
	Cache *cache.Cache
	AI    *aiclient.Client
}

func ruleFromInput(in *model.PayRuleInput) payroll.Rule {
	if in == nil {
		return payroll.Rule{}
	}
	return payroll.Rule{
		BaseSalary: in.BaseSalary, BonusType: string(in.BonusType), SalesPerBonus: in.SalesPerBonus,
		BonusAmount: in.BonusAmount, PctTargetMet: in.BonusPctTargetMet, PctTargetMissed: in.BonusPctTargetMissed,
	}
}

func ruleFromModel(in *model.PayRule) payroll.Rule {
	return payroll.Rule{
		BaseSalary: in.BaseSalary, BonusType: string(in.BonusType), SalesPerBonus: in.SalesPerBonus,
		BonusAmount: in.BonusAmount, PctTargetMet: in.BonusPctTargetMet, PctTargetMissed: in.BonusPctTargetMissed,
	}
}

func strOr(s *string, fallback string) string {
	if s == nil || *s == "" {
		return fallback
	}
	return *s
}

// buildPreview loads the rule + sales and runs the calculator. It is shared by
// the payoutPreview query and the payMarketer mutation, so what you see in the
// confirm dialog is exactly what gets saved.
func (r *Resolver) buildPreview(ctx context.Context, in model.PayInput) (*model.PayoutPreview, payroll.Rule, error) {
	start, end, err := period.Parse(in.Period)
	if err != nil {
		return nil, payroll.Rule{}, err
	}
	b, err := r.Store.GetBusiness(ctx, in.BusinessID)
	if err != nil {
		return nil, payroll.Rule{}, err
	}
	name, err := r.Store.MarketerName(ctx, in.MarketerID, in.BusinessID)
	if err != nil {
		return nil, payroll.Rule{}, err
	}
	sales, err := r.Store.SalesCount(ctx, in.MarketerID, in.BusinessID, start, end)
	if err != nil {
		return nil, payroll.Rule{}, err
	}
	paid, err := r.Store.PayoutExists(ctx, in.MarketerID, in.BusinessID, in.Period)
	if err != nil {
		return nil, payroll.Rule{}, err
	}

	rule := ruleFromModel(b.Rule)
	res := payroll.Calculate(rule, sales, in.TargetAchieved)
	return &model.PayoutPreview{
		MarketerID: in.MarketerID, MarketerName: name,
		BusinessID: b.ID, BusinessName: b.Name,
		Period: in.Period, SalesCount: sales, TargetAchieved: in.TargetAchieved,
		BaseSalary: res.BaseSalary, BonusRaw: res.BonusRaw, BonusPct: res.BonusPct,
		BonusFinal: res.BonusFinal, Total: res.Total,
		RuleSummary: rule.Summary(), AlreadyPaid: paid,
	}, rule, nil
}

func (r *Resolver) payrollRows(ctx context.Context, businessID *string, p string) ([]*model.MarketerStat, error) {
	start, end, err := period.Parse(p)
	if err != nil {
		return nil, err
	}
	key := r.Cache.Key(ctx, cache.NSSales, "payroll", strOr(businessID, "all"), p)
	return cache.Remember(ctx, r.Cache, key, 5*time.Minute, func() ([]*model.MarketerStat, error) {
		return r.Store.Payroll(ctx, businessID, p, start, end)
	})
}