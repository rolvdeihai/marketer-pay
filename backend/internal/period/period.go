// backend/internal/period/period.go
package period

import (
	"fmt"
	"time"
)

// WIB = Western Indonesia Time (UTC+7, no daylight saving).
// A fixed zone avoids depending on tzdata being installed on the server.
var WIB = time.FixedZone("WIB", 7*60*60)

// Parse turns "2026-11" into [start, end) in WIB.
func Parse(p string) (time.Time, time.Time, error) {
	start, err := time.ParseInLocation("2006-01", p, WIB)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid period %q, expected YYYY-MM", p)
	}
	return start, start.AddDate(0, 1, 0), nil
}

func Current() string { return time.Now().In(WIB).Format("2006-01") }

// Of returns the period a timestamp belongs to.
func Of(t time.Time) string { return t.In(WIB).Format("2006-01") }