// backend/internal/store/businesses.go
package store

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"marketerpay/graph/model"
)

const businessSelect = `
select b.id::text, b.name, b.slug, b.created_at, r.base_salary,
       r.met_bonus_type::text, r.met_sales_per_bonus, r.met_bonus_amount, r.bonus_pct_target_met,
       r.missed_bonus_type::text, r.missed_sales_per_bonus, r.missed_bonus_amount, r.bonus_pct_target_missed
from businesses b
join pay_rules r on r.business_id = b.id`

func scanBusiness(row pgx.Row) (*model.Business, error) {
	met, missed := &model.BonusRule{}, &model.BonusRule{}
	b := &model.Business{Rule: &model.PayRule{TargetMet: met, TargetMissed: missed}}
	var metType, missedType string
	err := row.Scan(&b.ID, &b.Name, &b.Slug, &b.CreatedAt, &b.Rule.BaseSalary,
		&metType, &met.SalesPerBonus, &met.BonusAmount, &met.BonusPct,
		&missedType, &missed.SalesPerBonus, &missed.BonusAmount, &missed.BonusPct)
	if err != nil {
		return nil, err
	}
	met.BonusType = model.BonusType(metType)
	missed.BonusType = model.BonusType(missedType)
	return b, nil
}

// ListBusinesses returns active (non-archived) businesses only.
func (s *Store) ListBusinesses(ctx context.Context) ([]*model.Business, error) {
	rows, err := s.pool.Query(ctx, businessSelect+` where b.active order by b.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*model.Business{}
	for rows.Next() {
		b, err := scanBusiness(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// GetBusiness also finds archived businesses, so history stays viewable.
func (s *Store) GetBusiness(ctx context.Context, id string) (*model.Business, error) {
	b, err := scanBusiness(s.pool.QueryRow(ctx, businessSelect+` where b.id = $1::uuid`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return b, err
}

// ruleArgs flattens a rule into the column order used by insert/update.
func ruleArgs(r *model.PayRuleInput) []any {
	return []any{
		r.BaseSalary,
		string(r.TargetMet.BonusType), r.TargetMet.SalesPerBonus, r.TargetMet.BonusAmount, r.TargetMet.BonusPct,
		string(r.TargetMissed.BonusType), r.TargetMissed.SalesPerBonus, r.TargetMissed.BonusAmount, r.TargetMissed.BonusPct,
	}
}

// CreateBusiness inserts the business and its pay rule in ONE transaction:
// either both rows exist or neither does.
func (s *Store) CreateBusiness(ctx context.Context, in model.BusinessInput) (*model.Business, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) // no-op after Commit

	name := strings.TrimSpace(in.Name)
	var id string
	if err := tx.QueryRow(ctx,
		`insert into businesses (name, slug) values ($1, $2) returning id::text`,
		name, slugify(name)).Scan(&id); err != nil {
		if isUniqueViolation(err) {
			return nil, errors.New("a business with that name already exists")
		}
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
insert into pay_rules (business_id, base_salary,
                       met_bonus_type, met_sales_per_bonus, met_bonus_amount, bonus_pct_target_met,
                       missed_bonus_type, missed_sales_per_bonus, missed_bonus_amount, bonus_pct_target_missed)
values ($1::uuid, $2, $3::bonus_type, $4, $5, $6, $7::bonus_type, $8, $9, $10)`,
		append([]any{id}, ruleArgs(in.Rule)...)...); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetBusiness(ctx, id)
}

func (s *Store) UpdatePayRule(ctx context.Context, businessID string, r model.PayRuleInput) (*model.Business, error) {
	tag, err := s.pool.Exec(ctx, `
update pay_rules set base_salary = $2,
       met_bonus_type = $3::bonus_type, met_sales_per_bonus = $4, met_bonus_amount = $5, bonus_pct_target_met = $6,
       missed_bonus_type = $7::bonus_type, missed_sales_per_bonus = $8, missed_bonus_amount = $9, bonus_pct_target_missed = $10,
       updated_at = now()
where business_id = $1::uuid`,
		append([]any{businessID}, ruleArgs(&r)...)...)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.GetBusiness(ctx, businessID)
}

// RemoveBusiness deletes the business (its products, rule and marketer links
// cascade). If sales or payouts reference it, it is archived instead.
func (s *Store) RemoveBusiness(ctx context.Context, id string) (model.RemoveResult, error) {
	return s.deleteOrArchive(ctx,
		`delete from businesses where id = $1::uuid`,
		`update businesses set active = false where id = $1::uuid`, id)
}
