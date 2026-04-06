package config

import "os"

// Config 基础数据中心运行时配置；后续可从 env / 配置中心加载。
type Config struct {
	HTTPAddr    string
	DatabaseURL string
}

func Load() Config {
	addr := os.Getenv("FOUNDATION_DATA_HTTP_ADDR")
	if addr == "" {
		addr = ":8081"
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
