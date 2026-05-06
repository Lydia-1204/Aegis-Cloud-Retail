package config

import "os"

// Config 基础数据中心运行时配置；后续可从 env / 配置中心加载。
type Config struct {
	HTTPAddr    string
	GRPCAddr    string
	DatabaseURL string
	JWTSecret   string
}

func Load() Config {
	addr := os.Getenv("FOUNDATION_DATA_HTTP_ADDR")
	if addr == "" {
		addr = ":8081"
	}
	grpcAddr := os.Getenv("FOUNDATION_DATA_GRPC_ADDR")
	if grpcAddr == "" {
		grpcAddr = ":50054"
	}
	dbURL := os.Getenv("GO_DATABASE_URL")
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}
	jwtSecret := os.Getenv("FOUNDATION_DATA_JWT_SECRET")
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
