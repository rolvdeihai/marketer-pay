// backend/internal/store/products.go
package store

import (
	"context"
	"errors"
	"strings"

	"marketerpay/graph/model"
)

func (s *Store) ListProducts(ctx context.Context, businessID *string) ([]*model.Product, error) {
	rows, err := s.pool.Query(ctx, `
select p.id::text, p.business_id::text, b.name, p.name, p.price
from products p
join businesses b on b.id = p.business_id
where p.active and b.active and ($1::uuid is null or p.business_id = $1::uuid)
order by b.name, p.name`, nullable(businessID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*model.Product{}
	for rows.Next() {
		p := &model.Product{}
		if err := rows.Scan(&p.ID, &p.BusinessID, &p.BusinessName, &p.Name, &p.Price); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) CreateProduct(ctx context.Context, in model.ProductInput) (*model.Product, error) {
	p := &model.Product{BusinessID: in.BusinessID, Name: strings.TrimSpace(in.Name), Price: in.Price}
	err := s.pool.QueryRow(ctx, `
with ins as (
  insert into products (business_id, name, price) values ($1::uuid, $2, $3)
  returning id, business_id
)
select ins.id::text, b.name from ins join businesses b on b.id = ins.business_id`,
		in.BusinessID, p.Name, in.Price).Scan(&p.ID, &p.BusinessName)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, errors.New("that business already has a product with this name")
		}
		return nil, err
	}
	return p, nil
}

// RemoveProduct deletes the product, or archives it if it has sales.
func (s *Store) RemoveProduct(ctx context.Context, id string) (model.RemoveResult, error) {
	return s.deleteOrArchive(ctx,
		`delete from products where id = $1::uuid`,
		`update products set active = false where id = $1::uuid`, id)
}