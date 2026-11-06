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
select b.id::text, b.name, b.slug, b.created_at,
       r.base_salary, r.bonus_type::text, r.sales_per_bonus, r.bonus_amount,
       r.bonus_pct_target_met, r.bonus_pct_target_missed
from businesses b
join pay_rules r on r.business_id = b.id`

func scanBusiness(row pgx.Row) (*model.Business, error) {
	b := &model.Business{Rule: &model.PayRule{}}
	var bonusType string
	err := row.Scan(&b.ID, &b.Name, &b.Slug, &b.CreatedAt,
		&b.Rule.BaseSalary, &bonusType, &b.Rule.SalesPerBonus, &b.Rule.BonusAmount,
		&b.Rule.BonusPctTargetMet, &b.Rule.BonusPctTargetMissed)
	if err != nil {
		return nil, err
	}
	b.Rule.BonusType = model.BonusType(bonusType)
	return b, nil
}

func (s *Store) ListBusinesses(ctx context.Context) ([]*model.Business, error) {
	rows, err := s.pool.Query(ctx, businessSelect+` order by b.name`)
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

func (s *Store) GetBusiness(ctx context.Context, id string) (*model.Business, error) {
	b, err := scanBusiness(s.pool.QueryRow(ctx, businessSelect+` where b.id = $1::uuid`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return b, err
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
		return nil, err
	}
	r := in.Rule
	if _, err := tx.Exec(ctx, `
insert into pay_rules (business_id, base_salary, bonus_type, sales_per_bonus, bonus_amount,
                       bonus_pct_target_met, bonus_pct_target_missed)
values ($1::uuid, $2, $3::bonus_type, $4, $5, $6, $7)`,
		id, r.BaseSalary, string(r.BonusType), r.SalesPerBonus, r.BonusAmount,
		r.BonusPctTargetMet, r.BonusPctTargetMissed); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetBusiness(ctx, id)
}

func (s *Store) UpdatePayRule(ctx context.Context, businessID string, r model.PayRuleInput) (*model.Business, error) {
	tag, err := s.pool.Exec(ctx, `
update pay_rules set base_salary = $2, bonus_type = $3::bonus_type, sales_per_bonus = $4,
       bonus_amount = $5, bonus_pct_target_met = $6, bonus_pct_target_missed = $7, updated_at = now()
where business_id = $1::uuid`,
		businessID, r.BaseSalary, string(r.BonusType), r.SalesPerBonus, r.BonusAmount,
		r.BonusPctTargetMet, r.BonusPctTargetMissed)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.GetBusiness(ctx, businessID)
}