// backend/internal/cache/cache.go
package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// Namespaces. Bumping a namespace's version makes all its old keys unreachable.
const (
	NSBusiness = "biz"
	NSSales    = "sales"
)

type Cache struct {
	rdb *redis.Client
}

// New returns a Cache. If url is empty or invalid, caching is simply disabled
// (every method becomes a no-op) so the app still works without Redis.
func New(url string) *Cache {
	if url == "" {
		log.Println("cache: REDIS_URL not set, caching disabled")
		return &Cache{}
	}
	opt, err := redis.ParseURL(url)
	if err != nil {
		log.Printf("cache: bad REDIS_URL (%v), caching disabled", err)
		return &Cache{}
	}
	opt.DialTimeout = 2 * time.Second
	opt.ReadTimeout = 2 * time.Second
	opt.WriteTimeout = 2 * time.Second
	return &Cache{rdb: redis.NewClient(opt)}
}

func (c *Cache) enabled() bool { return c != nil && c.rdb != nil }

// Key builds a versioned key like "sales:v7:dash:all:2026-11".
func (c *Cache) Key(ctx context.Context, ns string, parts ...string) string {
	var v int64
	if c.enabled() {
		v, _ = c.rdb.Get(ctx, "ver:"+ns).Int64() // missing -> 0
	}
	return fmt.Sprintf("%s:v%d:%s", ns, v, strings.Join(parts, ":"))
}

// Bump invalidates every key in the given namespaces in O(1).
func (c *Cache) Bump(ctx context.Context, namespaces ...string) {
	if !c.enabled() {
		return
	}
	for _, ns := range namespaces {
		if err := c.rdb.Incr(ctx, "ver:"+ns).Err(); err != nil {
			log.Printf("cache: bump %s: %v", ns, err)
		}
	}
}

// Remember is the cache-aside pattern: return cached JSON if present,
// otherwise run fn, store its result with a TTL, and return it.
func Remember[T any](ctx context.Context, c *Cache, key string, ttl time.Duration, fn func() (T, error)) (T, error) {
	if c.enabled() {
		if b, err := c.rdb.Get(ctx, key).Bytes(); err == nil {
			var v T
			if json.Unmarshal(b, &v) == nil {
				return v, nil
			}
		}
	}
	v, err := fn()
	if err != nil {
		return v, err
	}
	if c.enabled() {
		if b, err := json.Marshal(v); err == nil {
			c.rdb.Set(ctx, key, b, ttl)
		}
	}
	return v, nil
}

// Allow is a fixed-window rate limiter: at most `limit` calls per window.
func (c *Cache) Allow(ctx context.Context, key string, limit int64, window time.Duration) bool {
	if !c.enabled() {
		return true
	}
	bucket := fmt.Sprintf("rl:%s:%d", key, time.Now().Unix()/int64(window.Seconds()))
	n, err := c.rdb.Incr(ctx, bucket).Result()
	if err != nil {
		return true // fail open: Redis trouble shouldn't block the user
	}
	if n == 1 {
		c.rdb.Expire(ctx, bucket, window)
	}
	return n <= limit
}