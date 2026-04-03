package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	addr := os.Getenv("STORE_OPS_HTTP_ADDR")
	if addr == "" {
		addr = ":8082"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"service":"store-ops","status":"ok"}`))
	})
	log.Printf("store-ops listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
