package store

import "testing"

func TestResetDemoDataRemovesBusinessRowsAndKeepsAccounts(t *testing.T) {
	db, err := Open(":memory:")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer db.Close()

	if err := db.SeedDemo(); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if err := db.CreateUser(UserRow{
		ID: "USR-ADM-001", Name: "Ada Okafor", Email: "admin@fayfort.com",
		PasswordHash: "hash", Role: "admin", Status: "ACTIVE",
	}); err != nil {
		t.Fatalf("user: %v", err)
	}

	deleted, err := db.ResetDemoData()
	if err != nil {
		t.Fatalf("reset: %v", err)
	}
	for _, table := range businessTables {
		n, err := db.TableCount(table)
		if err != nil {
			t.Fatalf("count %s: %v", table, err)
		}
		if n != 0 {
			t.Errorf("expected %s empty after reset, got %d rows", table, n)
		}
	}
	for _, table := range []string{"customers", "sourcing_requests", "threads", "quotes", "orders"} {
		if deleted[table] < 1 {
			t.Errorf("expected %s to have deleted seeded rows, got %d", table, deleted[table])
		}
	}

	// Accounts survive the reset so nobody is logged out.
	if _, err := db.UserByEmail("admin@fayfort.com"); err != nil {
		t.Errorf("account should survive reset: %v", err)
	}
}