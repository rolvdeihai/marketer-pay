// backend/internal/config/config.go
package config

import (
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	DatabaseURL    string
	RedisURL       string
	SupabaseURL    string
	AIServiceURL   string
	AIServiceKey   string
	AllowedOrigins []string
	AuthDisabled   bool
	Dev            bool
}

// Load reads environment variables. Locally they come from .env;
// on Vercel they come from the project's Environment Variables.
func Load() Config {
	_ = godotenv.Load() // no .env on Vercel -> error ignored on purpose

	return Config{
		Port:           getenv("PORT", "8080"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		RedisURL:       os.Getenv("REDIS_URL"),
		SupabaseURL:    strings.TrimRight(os.Getenv("SUPABASE_URL"), "/"),
		AIServiceURL:   os.Getenv("AI_SERVICE_URL"),
		AIServiceKey:   os.Getenv("AI_SERVICE_KEY"),
		AllowedOrigins: strings.Split(getenv("CORS_ORIGINS", "*"), ","),
		AuthDisabled:   os.Getenv("AUTH_DISABLED") == "true",
		Dev:            os.Getenv("APP_ENV") != "production",
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}