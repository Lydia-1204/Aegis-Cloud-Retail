package main

import (
	"database/sql"
	"log"
	"net"
	"net/http"
	"time"

	"aegis/store-ops/internal/app"
	"aegis/store-ops/internal/config"

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

	srv := app.NewServer(db, cfg.JWTSecret, cfg.AIAnalysisGRPCAddrs)

	grpcListener, err := net.Listen("tcp", cfg.GRPCAddr)
	if err != nil {
		log.Fatalf("listen grpc: %v", err)
	}
	grpcServer := grpc.NewServer()
	if err := app.RegisterGRPC(grpcServer, db); err != nil {
		log.Fatalf("register grpc: %v", err)
	}
	go func() {
		log.Printf("store-ops grpc listening on %s", cfg.GRPCAddr)
		if err := grpcServer.Serve(grpcListener); err != nil {
			log.Fatalf("serve grpc: %v", err)
		}
	}()
	defer grpcServer.GracefulStop()

	log.Printf("store-ops listening on %s", cfg.HTTPAddr)
	if err := http.ListenAndServe(cfg.HTTPAddr, srv.Routes()); err != nil {
		log.Fatal(err)
	}
}
