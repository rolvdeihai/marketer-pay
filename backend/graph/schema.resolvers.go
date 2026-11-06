// backend/graph/schema.resolvers.go
package graph

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"marketerpay/graph/model"
	"marketerpay/internal/aiclient"
	"marketerpay/internal/auth"
	"marketerpay/internal/cache"
	"marketerpay/internal/period"
	"marketerpay/internal/store"
)

// ============================ Mutations ============================

func (r *mutationResolver) CreateBusiness(ctx context.Context, input model.BusinessInput) (*model.Business, error) {
	if strings.TrimSpace(input.Name) == "" {
		return nil, errors.New("name is required")
	}
	if err := ruleFromInput(input.Rule).Validate(); err != nil {
		return nil, err
	}
	b, err := r.Store.CreateBusiness(ctx, input)
	if err != nil {
		return nil, err
	}
	r.Cache.Bump(ctx, cache.NSBusiness, cache.NSSales)
	return b, nil
}

func (r *mutationResolver) UpdatePayRule(ctx context.Context, businessID string, input model.PayRuleInput) (*model.Business, error) {
	if err := ruleFromInput(&input).Validate(); err != nil {
		return nil, err
	}
	b, err := r.Store.UpdatePayRule(ctx, businessID, input)
	if err != nil {
		return nil, err
	}
	r.Cache.Bump(ctx, cache.NSBusiness)
	return b, nil
}

func (r *mutationResolver) CreateMarketer(ctx context.Context, input model.MarketerInput) (*model.Marketer, error) {
	if strings.TrimSpace(input.Name) == "" {
		return nil, errors.New("name is required")
	}
	if len(input.Businesses) == 0 {
		return nil, errors.New("pick at least one business")
	}
	m, err := r.Store.CreateMarketer(ctx, input)
	if err != nil {
		return nil, err
	}
	r.Cache.Bump(ctx, cache.NSSales)
	return m, nil
}

func (r *mutationResolver) CreateProduct(ctx context.Context, input model.ProductInput) (*model.Product, error) {
	if strings.TrimSpace(input.Name) == "" || input.Price < 0 {
		return nil, errors.New("name is required and price can't be negative")
	}
	return r.Store.CreateProduct(ctx, input)
}

func (r *mutationResolver) CreateTransaction(ctx context.Context, input model.TransactionInput) (*model.Transaction, error) {
	t, err := r.Store.CreateTransaction(ctx, input)
	if err != nil {
		return nil, err
	}
	r.Cache.Bump(ctx, cache.NSSales)
	return t, nil
}

func (r *mutationResolver) DeleteTransaction(ctx context.Context, id string) (bool, error) {
	if err := r.Store.DeleteTransaction(ctx, id); err != nil {
		return false, err
	}
	r.Cache.Bump(ctx, cache.NSSales)
	return true, nil
}

func (r *mutationResolver) PayMarketer(ctx context.Context, input model.PayInput) (*model.Payout, error) {
	preview, rule, err := r.buildPreview(ctx, input) // recalculated on the server, never trusted from the client
	if err != nil {
		return nil, err
	}
	if preview.AlreadyPaid {
		return nil, store.ErrAlreadyPaid
	}
	snapshot, _ := json.Marshal(rule)
	paidBy := ""
	if u := auth.UserFrom(ctx); u != nil {
		paidBy = u.Email
	}
	payout, err := r.Store.CreatePayout(ctx, preview, string(snapshot), paidBy)
	if err != nil {
		return nil, err
	}
	r.Cache.Bump(ctx, cache.NSSales)
	return payout, nil
}

func (r *mutationResolver) AskAssistant(ctx context.Context, input model.AskInput) (*model.AssistantReply, error) {
	uid := "anonymous"
	if u := auth.UserFrom(ctx); u != nil {
		uid = u.ID
	}
	// Protect the Gemini bill: max 10 questions per user per minute.
	if !r.Cache.Allow(ctx, "ai:"+uid, 10, time.Minute) {
		return nil, errors.New("slow down — max 10 questions per minute")
	}
	if len(input.Messages) == 0 {
		return nil, errors.New("no message")
	}

	req := aiclient.Request{Messages: make([]aiclient.ChatMessage, 0, len(input.Messages))}
	for _, m := range input.Messages {
		req.Messages = append(req.Messages, aiclient.ChatMessage{Role: m.Role, Content: m.Content})
	}
	if input.BusinessID != nil && *input.BusinessID != "" {
		b, err := r.Store.GetBusiness(ctx, *input.BusinessID)
		if err != nil {
			return nil, err
		}
		req.BusinessID = &b.ID
		req.BusinessName = b.Name
	}

	reply, err := r.AI.Ask(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("assistant unavailable: %w", err)
	}
	return &model.AssistantReply{Text: reply.Text, HTML: reply.HTML}, nil
}

// ============================ Queries ============================

func (r *queryResolver) Businesses(ctx context.Context) ([]*model.Business, error) {
	key := r.Cache.Key(ctx, cache.NSBusiness, "list")
	return cache.Remember(ctx, r.Cache, key, 10*time.Minute, func() ([]*model.Business, error) {
		return r.Store.ListBusinesses(ctx)
	})
}

func (r *queryResolver) Marketers(ctx context.Context, businessID *string) ([]*model.Marketer, error) {
	return r.Store.ListMarketers(ctx, businessID)
}

func (r *queryResolver) Products(ctx context.Context, businessID *string) ([]*model.Product, error) {
	return r.Store.ListProducts(ctx, businessID)
}

func (r *queryResolver) Transactions(ctx context.Context, businessID *string, periodArg *string) ([]*model.Transaction, error) {
	var start, end *time.Time
	if periodArg != nil && *periodArg != "" {
		s, e, err := period.Parse(*periodArg)
		if err != nil {
			return nil, err
		}
		start, end = &s, &e
	}
	return r.Store.ListTransactions(ctx, businessID, start, end)
}

func (r *queryResolver) Dashboard(ctx context.Context, businessID *string, periodArg string) (*model.DashboardStats, error) {
	rows, err := r.payrollRows(ctx, businessID, periodArg) // cached
	if err != nil {
		return nil, err
	}
	stats := &model.DashboardStats{Period: periodArg, TopMarketers: []*model.MarketerStat{}}
	for _, row := range rows {
		stats.TotalSales += row.SalesCount
		stats.TotalRevenue += row.Revenue
		if !row.IsPaid {
			stats.UnpaidCount++
		}
	}
	top := rows // already sorted by sales desc
	if len(top) > 5 {
		top = top[:5]
	}
	stats.TopMarketers = top
	return stats, nil
}

func (r *queryResolver) Payroll(ctx context.Context, businessID *string, periodArg string) ([]*model.MarketerStat, error) {
	return r.payrollRows(ctx, businessID, periodArg)
}

func (r *queryResolver) PayoutPreview(ctx context.Context, input model.PayInput) (*model.PayoutPreview, error) {
	p, _, err := r.buildPreview(ctx, input)
	return p, err
}

func (r *queryResolver) Payouts(ctx context.Context, businessID *string) ([]*model.Payout, error) {
	return r.Store.ListPayouts(ctx, businessID)
}

// Mutation returns MutationResolver implementation.
func (r *Resolver) Mutation() MutationResolver { return &mutationResolver{r} }

// Query returns QueryResolver implementation.
func (r *Resolver) Query() QueryResolver { return &queryResolver{r} }

type mutationResolver struct{ *Resolver }
type queryResolver struct{ *Resolver }