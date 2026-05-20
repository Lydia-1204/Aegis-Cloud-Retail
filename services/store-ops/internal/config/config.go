package config

import (
	"os"
	"strings"
)

type Config struct {
	HTTPAddr            string
	GRPCAddr            string
	DatabaseURL         string
	JWTSecret           string
	AIAnalysisGRPCAddrs []string
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
	aiAnalysisAddrs := splitCSV(os.Getenv("AI_ANALYSIS_GRPC_ADDRS"))
	if len(aiAnalysisAddrs) == 0 {
		aiAnalysisAddrs = splitCSV(os.Getenv("AI_ANALYSIS_GRPC_ADDR"))
	}
	if len(aiAnalysisAddrs) == 0 {
		aiAnalysisAddrs = []string{"localhost:50053"}
	}
	return Config{
		HTTPAddr:            addr,
		GRPCAddr:            grpcAddr,
		DatabaseURL:         dbURL,
		JWTSecret:           jwtSecret,
		AIAnalysisGRPCAddrs: aiAnalysisAddrs,
	}
}

func splitCSV(raw string) []string {
	parts := strings.Split(raw, ",")
	addrs := make([]string, 0, len(parts))
	for _, part := range parts {
		addr := strings.TrimSpace(part)
		if addr != "" {
			addrs = append(addrs, addr)
		}
	}
	return addrs
}
