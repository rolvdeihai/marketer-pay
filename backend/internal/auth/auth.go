// backend/internal/auth/auth.go
package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

type User struct {
	ID    string
	Email string
}

type ctxKey struct{}

// UserFrom returns the logged-in user (or nil) from a request context.
func UserFrom(ctx context.Context) *User {
	u, _ := ctx.Value(ctxKey{}).(*User)
	return u
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte(`{"errors":[{"message":"unauthorized"}]}`))
}

// Middleware verifies the Supabase access token sent as "Authorization: Bearer <jwt>".
func Middleware(supabaseURL string, disabled bool) (func(http.Handler) http.Handler, error) {
	if disabled { // local development only: pretend everyone is "dev"
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				ctx := context.WithValue(r.Context(), ctxKey{}, &User{ID: "dev", Email: "dev@local"})
				next.ServeHTTP(w, r.WithContext(ctx))
			})
		}, nil
	}

	// keyfunc downloads the JWKS, caches it, and refreshes it in the background.
	jwks, err := keyfunc.NewDefault([]string{supabaseURL + "/auth/v1/.well-known/jwks.json"})
	if err != nil {
		return nil, err
	}
	issuer := supabaseURL + "/auth/v1"

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions { // CORS preflight carries no token
				next.ServeHTTP(w, r)
				return
			}
			raw := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
			if raw == "" {
				writeUnauthorized(w)
				return
			}
			claims := jwt.MapClaims{}
			token, err := jwt.ParseWithClaims(raw, claims, jwks.Keyfunc,
				jwt.WithValidMethods([]string{"ES256", "RS256"}),
				jwt.WithIssuer(issuer),
				jwt.WithAudience("authenticated"),
			)
			if err != nil || !token.Valid {
				writeUnauthorized(w)
				return
			}
			sub, _ := claims.GetSubject()
			email, _ := claims["email"].(string)
			ctx := context.WithValue(r.Context(), ctxKey{}, &User{ID: sub, Email: email})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}, nil
}