// backend/internal/store/marketers.go
package store

import (
	"context"
	"strings"

	"marketerpay/graph/model"
)

// listMarketers optionally filters by business and/or a single marketer id.
// Archived (inactive) marketers are left out.
func (s *Store) listMarketers(ctx context.Context, businessID, marketerID any) ([]*model.Marketer, error) {
	rows, err := s.pool.Query(ctx, `
select m.id::text, m.name, m.phone, m.active
from marketers m
where m.active
  and ($2::uuid is null or m.id = $2::uuid)
  and ($1::uuid is null or exists (
        select 1 from marketer_businesses mb
        where mb.marketer_id = m.id and mb.business_id = $1::uuid))
order by m.name`, businessID, marketerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []*model.Marketer{}
	byID := map[string]*model.Marketer{}
	for rows.Next() {
		m := &model.Marketer{Businesses: []*model.BusinessRef{}}
		if err := rows.Scan(&m.ID, &m.Name, &m.Phone, &m.Active); err != nil {
			return nil, err
		}
		out = append(out, m)
		byID[m.ID] = m
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Second query: which businesses each marketer belongs to (2 queries total, not N+1).
	mrows, err := s.pool.Query(ctx, `
select mb.marketer_id::text, b.id::text, b.name
from marketer_businesses mb
join businesses b on b.id = mb.business_id
where b.active
order by b.name`)
	if err != nil {
		return nil, err
	}
	defer mrows.Close()
	for mrows.Next() {
		var mid string
		ref := &model.BusinessRef{}
		if err := mrows.Scan(&mid, &ref.ID, &ref.Name); err != nil {
			return nil, err
		}
		if m, ok := byID[mid]; ok {
			m.Businesses = append(m.Businesses, ref)
		}
	}
	return out, mrows.Err()
}

func (s *Store) ListMarketers(ctx context.Context, businessID *string) ([]*model.Marketer, error) {
	return s.listMarketers(ctx, nullable(businessID), nil)
}

func (s *Store) CreateMarketer(ctx context.Context, in model.MarketerInput) (*model.Marketer, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var id string
	if err := tx.QueryRow(ctx, `insert into marketers (name, phone) values ($1, $2) returning id::text`,
		strings.TrimSpace(in.Name), in.Phone).Scan(&id); err != nil {
		return nil, err
	}
	for _, bid := range in.Businesses {
		if _, err := tx.Exec(ctx,
			`insert into marketer_businesses (marketer_id, business_id) values ($1::uuid, $2::uuid)`,
			id, bid); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	list, err := s.listMarketers(ctx, nil, id)
	if err != nil || len(list) == 0 {
		return nil, ErrNotFound
	}
	return list[0], nil
}

// RemoveMarketer deletes the marketer, or archives them (active = false) if
// they have sales or payouts.
func (s *Store) RemoveMarketer(ctx context.Context, id string) (model.RemoveResult, error) {
	return s.deleteOrArchive(ctx,
		`delete from marketers where id = $1::uuid`,
		`update marketers set active = false where id = $1::uuid`, id)
}

// ActiveMarketer reports whether the marketer exists and isn't archived.
func (s *Store) ActiveMarketer(ctx context.Context, id string) (bool, error) {
	var ok bool
	err := s.pool.QueryRow(ctx, `select exists(select 1 from marketers where id = $1::uuid and active)`, id).Scan(&ok)
	return ok, err
}

// MarketerName also verifies the marketer belongs to the business.
func (s *Store) MarketerName(ctx context.Context, marketerID, businessID string) (string, error) {
	var name string
	err := s.pool.QueryRow(ctx, `
select m.name from marketers m
join marketer_businesses mb on mb.marketer_id = m.id
where m.id = $1::uuid and mb.business_id = $2::uuid`, marketerID, businessID).Scan(&name)
	if err != nil {
		return "", ErrNotFound
	}
	return name, nil
}