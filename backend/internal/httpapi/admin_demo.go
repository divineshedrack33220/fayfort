package httpapi

import (
	"net/http"

	"fayfort/backend/internal/store"
)

// demoCountTables mirrors store.businessTables (minus nothing) so the console
// shows post-action row counts for exactly the datasets it can control.
var demoCountTables = []string{
	"customers",
	"suppliers",
	"shipments",
	"threads",
	"quotes",
	"orders",
	"inspections",
	"sourcing_requests",
	"activity",
	"admin_notifications",
	"customer_notifications",
}

// handleDemoLoad populates the reference demo dataset on top of real data.
// Seeding is idempotent per table (rows are only added to empty tables), so
// this is safe to run against a production database: existing records are
// never touched.
func (s *Server) handleDemoLoad(w http.ResponseWriter, _ *http.Request) {
	if err := s.Store.SeedDemo(); err != nil {
		s.Log.Printf("demo load: %v", err)
		writeError(w, http.StatusInternalServerError, "could not load demo data")
		return
	}
	writeDemoCounts(w, s.Store)
}

// handleDemoReset wipes every business table. Pass ?seed=true to immediately
// replay the demo dataset afterwards. Accounts, sessions and push
// subscriptions are kept, so the caller stays signed in and devices keep
// receiving notifications.
func (s *Server) handleDemoReset(w http.ResponseWriter, r *http.Request) {
	reseed := r.URL.Query().Get("seed") == "true"
	deleted, err := s.Store.ResetDemoData()
	if err != nil {
		s.Log.Printf("demo reset: %v", err)
		writeError(w, http.StatusInternalServerError, "could not reset data")
		return
	}
	if reseed {
		if err := s.Store.SeedDemo(); err != nil {
			s.Log.Printf("demo reset+seed: %v", err)
			writeError(w, http.StatusInternalServerError, "data reset, but reloading the demo dataset failed")
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": deleted, "seeded": reseed})
}

func writeDemoCounts(w http.ResponseWriter, db *store.DB) {
	counts := make(map[string]int64, len(demoCountTables))
	for _, table := range demoCountTables {
		n, err := db.TableCount(table)
		if err != nil {
			// Report what we have; a failed count is not worth failing the
			// whole action for.
			continue
		}
		counts[table] = n
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "tables": counts})
}