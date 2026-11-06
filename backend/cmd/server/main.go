// backend/cmd/server/main.go
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/rs/cors"
	"github.com/vektah/gqlparser/v2/ast"

	"marketerpay/graph"
	"marketerpay/internal/aiclient"
	"marketerpay/internal/auth"
	"marketerpay/internal/cache"
	"marketerpay/internal/config"
	"marketerpay/internal/db"
	"marketerpay/internal/store"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	resolver := &graph.Resolver{
		Store: store.New(pool),
		Cache: cache.New(cfg.RedisURL),
		AI:    aiclient.New(cfg.AIServiceURL, cfg.AIServiceKey),
	}

	gql := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: resolver}))
	gql.AddTransport(transport.Options{})
	gql.AddTransport(transport.GET{})
	gql.AddTransport(transport.POST{})
	gql.SetQueryCache(lru.New[*ast.QueryDocument](1000)) // caches parsed queries
	gql.Use(extension.Introspection{})

	authMW, err := auth.Middleware(cfg.SupabaseURL, cfg.AuthDisabled)
	if err != nil {
		log.Fatalf("auth: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle("/graphql", authMW(gql))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	if cfg.Dev {
		mux.Handle("/", playground.Handler("Marketer Pay GraphQL", "/graphql"))
	}

	h := cors.New(cors.Options{
		AllowedOrigins: cfg.AllowedOrigins,
		AllowedMethods: []string{http.MethodGet, http.MethodPost, http.MethodOptions},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
		MaxAge:         600,
	}).Handler(mux)

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: h, ReadHeaderTimeout: 10 * time.Second}
	log.Printf("GraphQL API listening on :%s (playground: %v)", cfg.Port, cfg.Dev)
	log.Fatal(srv.ListenAndServe())
}