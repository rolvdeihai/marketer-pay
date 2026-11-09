// backend/internal/store/store.go
package store

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"marketerpay/graph/model"
)

var (
	ErrNotFound    = errors.New("not found")
	ErrAlreadyPaid = errors.New("this marketer has already been paid for that period")
	ErrPeriodPaid  = errors.New("that month is already paid for this marketer — sales can't be changed")
)

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// nullable turns an optional GraphQL ID into SQL NULL when it's absent, so
// queries can use the pattern  ($1::uuid is null or col = $1::uuid).
func nullable(s *string) any {
	if s == nil || *s == "" {
		return nil
	}
	return *s
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	return strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(s), "-"), "-")
}

// isUniqueViolation reports a Postgres unique-constraint error (23505).
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// deleteOrArchive tries a hard delete. If other rows still reference the
// record (foreign-key violation 23503, i.e. it has sales/payout history),
// the delete is rolled back and archiveSQL runs instead.
func (s *Store) deleteOrArchive(ctx context.Context, deleteSQL, archiveSQL, id string) (model.RemoveResult, error) {
	tag, err := s.pool.Exec(ctx, deleteSQL, id)
	if err == nil {
		if tag.RowsAffected() == 0 {
			return "", ErrNotFound
		}
		return model.RemoveResultDeleted, nil
	}
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23503" {
		return "", err
	}
	tag, err = s.pool.Exec(ctx, archiveSQL, id)
	if err != nil {
		return "", err
	}
	if tag.RowsAffected() == 0 {
		return "", ErrNotFound
	}
	return model.RemoveResultArchived, nil
}
