// backend/internal/store/payroll.go
package store

import (
	"context"
	"time"

	"marketerpay/graph/model"
)

// Payroll returns one row per (active marketer, business) for the month,
// with sales, revenue and whether a payout already exists.
func (s *Store) Payroll(ctx context.Context, businessID *string, p string, start, end time.Time) ([]*model.MarketerStat, error) {
	rows, err := s.pool.Query(ctx, `
with members as (
  select mb.marketer_id, mb.business_id
  from marketer_businesses mb
  join marketers m on m.id = mb.marketer_id
  join businesses b on b.id = mb.business_id
  where m.active and b.active and ($1::uuid is null or mb.business_id = $1::uuid)
),
sales as (
  select marketer_id, business_id, count(*)::int as cnt, coalesce(sum(amount), 0)::bigint as revenue
  from transactions
  where sold_at >= $2::timestamptz and sold_at < $3::timestamptz
    and ($1::uuid is null or business_id = $1::uuid)
  group by marketer_id, business_id
)
select mem.marketer_id::text, m.name, mem.business_id::text, b.name,
       coalesce(s.cnt, 0), coalesce(s.revenue, 0)::bigint,
       p.total, p.paid_at
from members mem
join marketers  m on m.id = mem.marketer_id
join businesses b on b.id = mem.business_id
left join sales s   on s.marketer_id = mem.marketer_id and s.business_id = mem.business_id
left join payouts p on p.marketer_id = mem.marketer_id and p.business_id = mem.business_id and p.period = $4
order by coalesce(s.cnt, 0) desc, m.name`, nullable(businessID), start, end, p)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []*model.MarketerStat{}
	for rows.Next() {
		r := &model.MarketerStat{}
		if err := rows.Scan(&r.MarketerID, &r.MarketerName, &r.BusinessID, &r.BusinessName,
			&r.SalesCount, &r.Revenue, &r.PaidTotal, &r.PaidAt); err != nil {
			return nil, err
		}
		r.IsPaid = r.PaidAt != nil
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) PayoutExists(ctx context.Context, marketerID, businessID, p string) (bool, error) {
	return s.payoutExists(ctx, marketerID, businessID, p)
}

// CreatePayout saves a payout. ON CONFLICT DO NOTHING + the unique constraint
// means a double-click (or two admins) can never pay twice.
func (s *Store) CreatePayout(ctx context.Context, pv *model.PayoutPreview, ruleJSON, paidBy string) (*model.Payout, error) {
	out := &model.Payout{
		MarketerID: pv.MarketerID, MarketerName: pv.MarketerName,
		BusinessID: pv.BusinessID, BusinessName: pv.BusinessName,
		Period: pv.Period, SalesCount: pv.SalesCount, TargetAchieved: pv.TargetAchieved,
		BaseSalary: pv.BaseSalary, BonusRaw: pv.BonusRaw, BonusPct: pv.BonusPct,
		BonusFinal: pv.BonusFinal, Total: pv.Total, PaidBy: &paidBy,
	}
	rows, err := s.pool.Query(ctx, `
insert into payouts (marketer_id, business_id, period, sales_count, target_achieved,
                     base_salary, bonus_raw, bonus_pct, bonus_final, total, rule_snapshot, paid_by)
values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
on conflict (marketer_id, business_id, period) do nothing
returning id::text, paid_at`,
		pv.MarketerID, pv.BusinessID, pv.Period, pv.SalesCount, pv.TargetAchieved,
		pv.BaseSalary, pv.BonusRaw, pv.BonusPct, pv.BonusFinal, pv.Total, ruleJSON, paidBy)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() { // conflict -> nothing returned
		if err := rows.Err(); err != nil {
			return nil, err
		}
		return nil, ErrAlreadyPaid
	}
	if err := rows.Scan(&out.ID, &out.PaidAt); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) ListPayouts(ctx context.Context, businessID *string) ([]*model.Payout, error) {
	rows, err := s.pool.Query(ctx, `
select p.id::text, p.marketer_id::text, m.name, p.business_id::text, b.name, p.period,
       p.sales_count, p.target_achieved, p.base_salary, p.bonus_raw, p.bonus_pct,
       p.bonus_final, p.total, p.paid_at, p.paid_by
from payouts p
join marketers  m on m.id = p.marketer_id
join businesses b on b.id = p.business_id
where $1::uuid is null or p.business_id = $1::uuid
order by p.paid_at desc
limit 300`, nullable(businessID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*model.Payout{}
	for rows.Next() {
		p := &model.Payout{}
		if err := rows.Scan(&p.ID, &p.MarketerID, &p.MarketerName, &p.BusinessID, &p.BusinessName,
			&p.Period, &p.SalesCount, &p.TargetAchieved, &p.BaseSalary, &p.BonusRaw, &p.BonusPct,
			&p.BonusFinal, &p.Total, &p.PaidAt, &p.PaidBy); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}