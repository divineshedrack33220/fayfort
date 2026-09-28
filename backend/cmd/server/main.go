// Command server runs the Fayfort standalone backend service.
//
// Usage:
//
//	server [-db path] [-addr :8080] [-seed]
//
// By default the service boots on an empty dataset so the console shows only
// real records; pass -seed to load the demo dataset (skip-if-populated). The
// admin@fayfort.com / admin123 account is always available.
package main

import (
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"fayfort/backend/internal/auth"
	"fayfort/backend/internal/httpapi"
	"fayfort/backend/internal/store"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	dbPath := flag.String("db", "fayfort.db", "SQLite database file (use :memory: to skip persistence)")
	seedDemo := flag.Bool("seed", false, "load the demo dataset on first boot")
	flag.Parse()

	discard := log.New(os.Stderr, "", 0)
	_ = discard
	format := log.New(os.Stderr, "[fayfort-backend] ", log.LstdFlags)

	db, err := store.Open(*dbPath)
	must(err, format)

	if *seedDemo {
		if err := db.SeedDemo(); err != nil {
			must(err, format)
		}
	}
	if err := seedAccounts(db, format); err != nil {
		must(err, format)
	}

	server := httpapi.New(db, format, os.Getenv("GOOGLE_CLIENT_ID"))
	apiServer := &http.Server{
		Addr:              *addr,
		Handler:           server.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	format.Printf("fayfort backend listening on %s (db: %s)", *addr, *dbPath)
	if err := apiServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		must(err, format)
	}
}

// seedAccounts provisions the demo admin and the demo customer this prototype
// uses. Password policy mirrors the frontend (>= 8 chars); storage is real
// argon2id now.
func seedAccounts(db *store.DB, format *log.Logger) error {
	_, err := db.UserByEmail("admin@fayfort.com")
	switch {
	case errors.Is(err, store.ErrNotFound):
		hash, hasErr := auth.HashPassword("admin123")
		if hasErr != nil {
			return hasErr
		}
		if hasErr = db.CreateUser(store.UserRow{
			ID: "USR-ADM-001", Name: "Ada Okafor", Email: "admin@fayfort.com",
			PasswordHash: hash, Role: "admin", Status: "ACTIVE", CreatedAt: nowRFC(),
		}); hasErr != nil {
			return hasErr
		}
		format.Printf("seeded admin account admin@fayfort.com")
	case err != nil:
		return err
	}

	_, err = db.UserByEmail("demo@example.com")
	switch {
	case errors.Is(err, store.ErrNotFound):
		hash, hasErr := auth.HashPassword("demo1234")
		if hasErr != nil {
			return hasErr
		}
		if hasErr = db.CreateUser(store.UserRow{
			ID: "USR-CUS-001", Name: "David Green", Email: "demo@example.com",
			PasswordHash: hash, Role: "customer", Status: "ACTIVE", CreatedAt: nowRFC(),
		}); hasErr != nil {
			return hasErr
		}
		format.Printf("seeded demo customer account demo@example.com")
	case err != nil:
		return err
	}
	return nil
}

func nowRFC() string { return time.Now().UTC().Format(time.RFC3339) }

func must(err error, format *log.Logger) {
	if err != nil {
		format.Fatalf("fatal: %v", err)
	}
}
