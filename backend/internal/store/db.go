// Package store provides the SQLite persistence layer for the Fayfort backend.
// The schema mirrors the frontend prototype's demo model; seed data reproduces
// the exact demo records so a wired-up client sees identical IDs and values.
package store

import (
	"database/sql"
	"errors"
	"time"

	_ "modernc.org/sqlite"

	turso "turso.tech/database/tursogo-serverless"
)

const schema = `
CREATE TABLE IF NOT EXISTS users (
	id            TEXT PRIMARY KEY,
	name          TEXT NOT NULL,
	email         TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	role          TEXT NOT NULL,
	status        TEXT NOT NULL,
	avatar_url    TEXT NOT NULL DEFAULT '',
	created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
	token      TEXT PRIMARY KEY,
	user_id    TEXT NOT NULL,
	created_at TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS customers (
	id             TEXT PRIMARY KEY,
	name           TEXT NOT NULL,
	email          TEXT NOT NULL,
	company        TEXT NOT NULL DEFAULT '',
	city           TEXT NOT NULL,
	currency       TEXT NOT NULL,
	requests       INTEGER NOT NULL,
	pipeline_value REAL NOT NULL,
	joined         TEXT NOT NULL,
	status         TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS suppliers (
	id            TEXT PRIMARY KEY,
	name          TEXT NOT NULL,
	city          TEXT NOT NULL,
	country       TEXT NOT NULL,
	category      TEXT NOT NULL,
	reliability   INTEGER NOT NULL,
	lead_days     TEXT NOT NULL,
	moq           TEXT NOT NULL,
	contact_email TEXT NOT NULL,
	contact_phone TEXT NOT NULL,
	payment_terms TEXT NOT NULL,
	products_json TEXT NOT NULL,
	notes         TEXT NOT NULL,
	requests      INTEGER NOT NULL,
	since         TEXT NOT NULL,
	status        TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shipments (
	id            TEXT PRIMARY KEY,
	request_id    TEXT NOT NULL,
	product       TEXT NOT NULL,
	customer      TEXT NOT NULL,
	supplier      TEXT NOT NULL,
	carrier       TEXT NOT NULL,
	mode          TEXT NOT NULL,
	origin        TEXT NOT NULL,
	destination   TEXT NOT NULL,
	container_ref TEXT NOT NULL,
	departed_at   TEXT NOT NULL DEFAULT '',
	eta           TEXT NOT NULL DEFAULT '',
	delivered_at  TEXT NOT NULL DEFAULT '',
	status        TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS threads (
	id         TEXT PRIMARY KEY,
	customer   TEXT NOT NULL,
	email      TEXT NOT NULL,
	subject    TEXT NOT NULL,
	ref        TEXT NOT NULL,
	unread     INTEGER NOT NULL,
	customer_unread INTEGER NOT NULL DEFAULT 0,
	status     TEXT NOT NULL,
	last_active TEXT NOT NULL,
	messages   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quotes (
	id         TEXT PRIMARY KEY,
	request_id TEXT NOT NULL,
	product    TEXT NOT NULL,
	customer   TEXT NOT NULL,
	supplier   TEXT NOT NULL,
	value_usd  REAL NOT NULL,
	margin_bps INTEGER NOT NULL,
	status     TEXT NOT NULL,
	issued_at  TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	image_urls TEXT NOT NULL DEFAULT '[]',
	decided_at TEXT NOT NULL DEFAULT '',
	decision_reason TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS activity (
	id         TEXT PRIMARY KEY,
	actor      TEXT NOT NULL,
	action     TEXT NOT NULL,
	target     TEXT NOT NULL DEFAULT '',
	request_id TEXT NOT NULL DEFAULT '',
	at         TEXT NOT NULL,
	tone       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sourcing_requests (
	id            TEXT PRIMARY KEY,
	product       TEXT NOT NULL,
	category      TEXT NOT NULL,
	customer      TEXT NOT NULL,
	city          TEXT NOT NULL,
	quantity      INTEGER NOT NULL,
	budget        REAL NOT NULL,
	currency      TEXT NOT NULL,
	status        TEXT NOT NULL,
	date          TEXT NOT NULL,
	submitted_by  TEXT NOT NULL DEFAULT '',
	supplier_hint TEXT NOT NULL DEFAULT '',
	destination   TEXT NOT NULL DEFAULT '',
	notes_body    TEXT NOT NULL DEFAULT '',
	contact_phone TEXT NOT NULL DEFAULT '',
	image_urls    TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS admin_notifications (
	id      TEXT PRIMARY KEY,
	kind    TEXT NOT NULL,
	message TEXT NOT NULL,
	time    TEXT NOT NULL,
	read    INTEGER NOT NULL,
	href    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customer_notifications (
	id         TEXT PRIMARY KEY,
	title      TEXT NOT NULL,
	body       TEXT NOT NULL,
	at         TEXT NOT NULL,
	read       INTEGER NOT NULL,
	request_id TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS orders (
	id            TEXT PRIMARY KEY,
	request_id    TEXT NOT NULL,
	customer      TEXT NOT NULL,
	product       TEXT NOT NULL,
	supplier      TEXT NOT NULL,
	quantity      INTEGER NOT NULL,
	unit_price_usd REAL NOT NULL,
	value_usd     REAL NOT NULL,
	status        TEXT NOT NULL,
	date          TEXT NOT NULL,
	eta           TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS inspections (
	id           TEXT PRIMARY KEY,
	order_id     TEXT NOT NULL,
	customer     TEXT NOT NULL,
	supplier     TEXT NOT NULL,
	product      TEXT NOT NULL,
	quantity     INTEGER NOT NULL,
	status       TEXT NOT NULL,
	scheduled_at TEXT NOT NULL,
	inspector    TEXT NOT NULL,
	notes        TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS contact_messages (
	id         TEXT PRIMARY KEY,
	name       TEXT NOT NULL,
	email      TEXT NOT NULL,
	message    TEXT NOT NULL,
	created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
	endpoint    TEXT PRIMARY KEY,
	p256dh      TEXT NOT NULL,
	auth        TEXT NOT NULL,
	user_email  TEXT NOT NULL,
	user_role   TEXT NOT NULL,
	created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_role ON push_subscriptions(user_role);
`

// DB wraps the SQLite connection and exposes the repository methods.
type DB struct {
	*sql.DB
}

// Open connects to a SQLite database file and applies the schema.
// Pass ":memory:" for an ephemeral database.
func Open(path string) (*DB, error) {
	conn, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	conn.SetMaxOpenConns(1) // SQLite: avoid lock contention
	if _, err := conn.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		_ = conn.Close()
		return nil, err
	}
	if err := applySchema(conn); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &DB{conn}, nil
}

// OpenRemote connects to a Turso Cloud database over HTTP via the
// turso-serverless database/sql driver. The same schema is applied
// idempotently, so a fresh remote database is ready on first boot and data
// survives backend restarts and deploys (the container writes nothing).
func OpenRemote(url, authToken string) (*DB, error) {
	conn := sql.OpenDB(turso.NewConnector(url, authToken))
	conn.SetMaxOpenConns(8)
	if err := applySchema(conn); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &DB{conn}, nil
}

func applySchema(conn *sql.DB) error {
	if _, err := conn.Exec(schema); err != nil {
		return err
	}
	// Idempotent migrations for database files created before a column was
	// added (fresh databases already include them).
	if err := migrateUsers(conn); err != nil {
		return err
	}
	return migrateQuotes(conn)
}

// migrateUsers ensures the users table carries the avatar column, adding it
// when a persisted database was created by an older schema.
func migrateUsers(conn *sql.DB) error {
	has := func(col string) bool {
		rows, err := conn.Query(`PRAGMA table_info(users)`)
		if err != nil {
			return false
		}
		defer rows.Close()
		for rows.Next() {
			var cid int
			var name, typeName string
			var notNull, pk int
			var dflt any
			if rows.Scan(&cid, &name, &typeName, &notNull, &dflt, &pk) == nil && name == col {
				return true
			}
		}
		return false
	}
	if !has("avatar_url") {
		_, err := conn.Exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''`)
		return err
	}
	return nil
}

// migrateQuotes ensures the quotes table carries the customer decision columns,
// adding them when a persisted database was created by an older schema.
func migrateQuotes(conn *sql.DB) error {
	has := func(col string) bool {
		rows, err := conn.Query(`PRAGMA table_info(quotes)`)
		if err != nil {
			return false
		}
		defer rows.Close()
		for rows.Next() {
			var cid int
			var name, typeName string
			var notNull, pk int
			var dflt any
			if rows.Scan(&cid, &name, &typeName, &notNull, &dflt, &pk) == nil && name == col {
				return true
			}
		}
		return false
	}
	if !has("decided_at") {
		if _, err := conn.Exec(`ALTER TABLE quotes ADD COLUMN decided_at TEXT NOT NULL DEFAULT ''`); err != nil {
			return err
		}
	}
	if !has("decision_reason") {
		if _, err := conn.Exec(`ALTER TABLE quotes ADD COLUMN decision_reason TEXT NOT NULL DEFAULT ''`); err != nil {
			return err
		}
	}
	return nil
}

// ErrNotFound is returned when a lookup matches nothing.
var ErrNotFound = errors.New("store: not found")

// businessTables are the user-visible datasets the admin demo-data actions
// load and wipe. Accounts (users) and sessions are intentionally excluded so a
// reset never logs people out, and push subscriptions are excluded so devices
// that already granted notification permission stay registered.
var businessTables = []string{
	"inspections",
	"orders",
	"quotes",
	"shipments",
	"sourcing_requests",
	"threads",
	"admin_notifications",
	"customer_notifications",
	"activity",
	"customers",
	"suppliers",
	"contact_messages",
}

// TableCount returns the number of rows in a table (for demo-data reporting).
func (db *DB) TableCount(table string) (int64, error) {
	var n int64
	err := db.QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&n)
	return n, err
}

// ResetDemoData deletes every business row (returning per-table deleted
// counts) while keeping accounts, sessions and push subscriptions intact. It
// is the explicit "wipe the data" action; call SeedDemo afterwards to replay
// the reference dataset.
func (db *DB) ResetDemoData() (map[string]int64, error) {
	deleted := make(map[string]int64, len(businessTables))
	for _, table := range businessTables {
		res, err := db.Exec(`DELETE FROM ` + table)
		if err != nil {
			return deleted, err
		}
		n, _ := res.RowsAffected()
		deleted[table] = n
	}
	return deleted, nil
}

// ---- users + sessions -----------------------------------------------------

func (db *DB) CreateUser(u UserRow) error {
	_, err := db.Exec(
		`INSERT INTO users (id, name, email, password_hash, role, status, avatar_url, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		u.ID, u.Name, u.Email, u.PasswordHash, u.Role, u.Status, u.AvatarURL, u.CreatedAt,
	)
	return err
}

type UserRow struct {
	ID           string
	Name         string
	Email        string
	PasswordHash string
	Role         string
	Status       string
	AvatarURL    string
	CreatedAt    string
}

func (db *DB) UserByEmail(email string) (UserRow, error) {
	row := db.QueryRow(
		`SELECT id, name, email, password_hash, role, status, avatar_url, created_at FROM users WHERE email = ?`,
		email,
	)
	return scanUser(row)
}

func (db *DB) UserByID(id string) (UserRow, error) {
	row := db.QueryRow(
		`SELECT id, name, email, password_hash, role, status, avatar_url, created_at FROM users WHERE id = ?`,
		id,
	)
	return scanUser(row)
}

// AllUsers lists every account (admins and customers) in creation order, for
// the staff console's account overview.
func (db *DB) AllUsers() ([]UserRow, error) {
	rows, err := db.Query(
		`SELECT id, name, email, password_hash, role, status, avatar_url, created_at FROM users ORDER BY created_at, id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]UserRow, 0)
	for rows.Next() {
		var u UserRow
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.Status, &u.AvatarURL, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (db *DB) UpdateUserAvatar(id, avatarURL string) error {
	_, err := db.Exec(`UPDATE users SET avatar_url = ? WHERE id = ?`, avatarURL, id)
	return err
}

func scanUser(row *sql.Row) (UserRow, error) {
	var u UserRow
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.Status, &u.AvatarURL, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return UserRow{}, ErrNotFound
	}
	return u, err
}

// CreateSession stores a session token bound to a user.
func (db *DB) CreateSession(token, userID string, ttl time.Duration) error {
	now := time.Now().UTC()
	_, err := db.Exec(
		`INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
		token, userID, now.Format(time.RFC3339), now.Add(ttl).Format(time.RFC3339),
	)
	return err
}

// SessionUser resolves a token to a user, deleting expired sessions along the way.
func (db *DB) SessionUser(token string) (UserRow, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := db.Exec(`DELETE FROM sessions WHERE expires_at < ?`, now); err != nil {
		return UserRow{}, err
	}
	var (
		userID  string
		expires string
	)
	err := db.QueryRow(`SELECT user_id, expires_at FROM sessions WHERE token = ?`, token).Scan(&userID, &expires)
	if errors.Is(err, sql.ErrNoRows) {
		return UserRow{}, ErrNotFound
	}
	if err != nil {
		return UserRow{}, err
	}
	if expires < now {
		_, _ = db.Exec(`DELETE FROM sessions WHERE token = ?`, token)
		return UserRow{}, ErrNotFound
	}
	return db.UserByID(userID)
}

// DeleteSession revokes a token.
func (db *DB) DeleteSession(token string) error {
	_, err := db.Exec(`DELETE FROM sessions WHERE token = ?`, token)
	return err
}
