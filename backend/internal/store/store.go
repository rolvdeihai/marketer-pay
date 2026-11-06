// backend/internal/store/store.go
package store

import (
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
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