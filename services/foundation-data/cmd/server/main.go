package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	addr := os.Getenv("FOUNDATION_DATA_HTTP_ADDR")
	if addr == "" {
		addr = ":8081"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"service":"foundation-data","status":"ok"}`))
	})
	log.Printf("foundation-data listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
