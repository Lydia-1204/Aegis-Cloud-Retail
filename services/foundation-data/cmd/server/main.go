package main

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"aegis/foundation-data/internal/app"
	"aegis/foundation-data/internal/config"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("missing GO_DATABASE_URL or DATABASE_URL")
	}

	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := db.Ping(); err != nil {
		log.Fatalf("ping db: %v", err)
	}

	srv := app.NewServer(db, cfg.JWTSecret)
	log.Printf("foundation-data listening on %s", cfg.HTTPAddr)
	if err := http.ListenAndServe(cfg.HTTPAddr, srv.Routes()); err != nil {
		log.Fatal(err)
	}
}
