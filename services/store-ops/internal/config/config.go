package config

import "os"

type Config struct {
	HTTPAddr    string
	DatabaseURL string
}

func Load() Config {
	addr := os.Getenv("STORE_OPS_HTTP_ADDR")
	if addr == "" {
		addr = ":8082"
	}
	dbURL := os.Getenv("GO_DATABASE_URL")
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}
	return Config{
		HTTPAddr:    addr,
		DatabaseURL: dbURL,
	}
}
