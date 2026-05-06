package main

import (
	"database/sql"
	"log"
	"net"
	"net/http"
	"time"

	"aegis/foundation-data/internal/app"
	"aegis/foundation-data/internal/config"

	_ "github.com/jackc/pgx/v5/stdlib"
	"google.golang.org/grpc"
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

	grpcListener, err := net.Listen("tcp", cfg.GRPCAddr)
	if err != nil {
		log.Fatalf("listen grpc: %v", err)
	}
	grpcServer := grpc.NewServer()
	app.RegisterGRPC(grpcServer, db)
	go func() {
		log.Printf("foundation-data grpc listening on %s", cfg.GRPCAddr)
		if err := grpcServer.Serve(grpcListener); err != nil {
			log.Fatalf("serve grpc: %v", err)
		}
	}()
	defer grpcServer.GracefulStop()

	log.Printf("foundation-data listening on %s", cfg.HTTPAddr)
	if err := http.ListenAndServe(cfg.HTTPAddr, srv.Routes()); err != nil {
		log.Fatal(err)
	}
}
