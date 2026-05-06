package config

import "os"

type Config struct {
	HTTPAddr    string
	GRPCAddr    string
	DatabaseURL string
	JWTSecret   string
}

func Load() Config {
	addr := os.Getenv("STORE_OPS_HTTP_ADDR")
	if addr == "" {
		addr = ":8082"
	}
	grpcAddr := os.Getenv("STORE_OPS_GRPC_ADDR")
	if grpcAddr == "" {
		grpcAddr = ":50055"
	}
	dbURL := os.Getenv("GO_DATABASE_URL")
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = os.Getenv("FOUNDATION_DATA_JWT_SECRET")
	}
	if jwtSecret == "" {
		jwtSecret = "foundation-data-dev-secret"
	}
	return Config{
		HTTPAddr:    addr,
		GRPCAddr:    grpcAddr,
		DatabaseURL: dbURL,
		JWTSecret:   jwtSecret,
	}
}
