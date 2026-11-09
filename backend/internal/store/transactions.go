// backend/internal/store/transactions.go
package store

import (
	"context"
	"errors"
	"time"

	"marketerpay/graph/model"
	"marketerpay/internal/period"
)

const txSelect = `
select t.id::text, t.business_id::text, b.name, t.marketer_id::text, m.name,
       t.product_id::text, p.name, t.amount, t.sold_at, t.note
from transactions t
join businesses b on b.id = t.business_id
join marketers  m on m.id = t.marketer_id
join products   p on p.id = t.product_id`

func (s *Store) queryTransactions(ctx context.Context, sql string, args ...any) ([]*model.Transaction, error) {
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*model.Transaction{}
	for rows.Next() {
		t := &model.Transaction{}
		if err := rows.Scan(&t.ID, &t.BusinessID, &t.BusinessName, &t.MarketerID, &t.MarketerName,
			&t.ProductID, &t.ProductName, &t.Amount, &t.SoldAt, &t.Note); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) ListTransactions(ctx context.Context, businessID *string, start, end *time.Time) ([]*model.Transaction, error) {
	var from, to any
	if start != nil {
		from, to = *start, *end
	}
	return s.queryTransactions(ctx, txSelect+`
where ($1::uuid is null or t.business_id = $1::uuid)
  and ($2::timestamptz is null or t.sold_at >= $2::timestamptz)
  and ($3::timestamptz is null or t.sold_at <  $3::timestamptz)
order by t.sold_at desc
limit 300`, nullable(businessID), from, to)
}

func (s *Store) payoutExists(ctx context.Context, marketerID, businessID, p string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `
select exists(select 1 from payouts
              where marketer_id = $1::uuid and business_id = $2::uuid and period = $3)`,
		marketerID, businessID, p).Scan(&exists)
	return exists, err
}

func (s *Store) CreateTransaction(ctx context.Context, in model.TransactionInput) (*model.Transaction, error) {
	// 1. Product must belong to the business; its price is the default amount.
	var price int64
	if err := s.pool.QueryRow(ctx,
		`select p.price from products p join businesses b on b.id = p.business_id
		 where p.id = $1::uuid and p.business_id = $2::uuid and p.active and b.active`,
		in.ProductID, in.BusinessID).Scan(&price); err != nil {
		return nil, errors.New("product not found in this business (it may be archived)")
	}
	// 2. Marketer must sell for this business and not be archived.
	if _, err := s.MarketerName(ctx, in.MarketerID, in.BusinessID); err != nil {
		return nil, errors.New("marketer is not assigned to this business")
	}
	if ok, err := s.ActiveMarketer(ctx, in.MarketerID); err != nil {
		return nil, err
	} else if !ok {
		return nil, errors.New("this marketer is archived")
	}

	amount := price
	if in.Amount != nil {
		amount = *in.Amount
	}
	soldAt := time.Now()
	if in.SoldAt != nil {
		soldAt = *in.SoldAt
	}
	if amount < 0 {
		return nil, errors.New("amount cannot be negative")
	}

	// 3. Don't allow adding sales to a month that's already been paid out.
	paid, err := s.payoutExists(ctx, in.MarketerID, in.BusinessID, period.Of(soldAt))
	if err != nil {
		return nil, err
	}
	if paid {
		return nil, ErrPeriodPaid
	}

	var id string
	if err := s.pool.QueryRow(ctx, `
insert into transactions (business_id, marketer_id, product_id, amount, sold_at, note)
values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)
returning id::text`,
		in.BusinessID, in.MarketerID, in.ProductID, amount, soldAt, in.Note).Scan(&id); err != nil {
		return nil, err
	}
	list, err := s.queryTransactions(ctx, txSelect+` where t.id = $1::uuid`, id)
	if err != nil || len(list) == 0 {
		return nil, ErrNotFound
	}
	return list[0], nil
}

func (s *Store) DeleteTransaction(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `
delete from transactions t
where t.id = $1::uuid
  and not exists (
    select 1 from payouts p
    where p.marketer_id = t.marketer_id and p.business_id = t.business_id
      and p.period = to_char(t.sold_at at time zone 'Asia/Jakarta', 'YYYY-MM'))`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("not found, or that month is already paid")
	}
	return nil
}

func (s *Store) SalesCount(ctx context.Context, marketerID, businessID string, start, end time.Time) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `
select count(*)::int from transactions
where marketer_id = $1::uuid and business_id = $2::uuid
  and sold_at >= $3::timestamptz and sold_at < $4::timestamptz`,
		marketerID, businessID, start, end).Scan(&n)
	return n, err
}