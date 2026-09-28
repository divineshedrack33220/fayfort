// Package auth handles password hashing and session tokens.
//
// The frontend prototype ships a mock password rule (>= 8 chars). The Go
// backend replaces that with real argon2id hashes; sessions are opaque random
// tokens stored server-side, so the old base64-MockSession cookie format is
// retired.
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	argonTime    = 1
	argonMemory  = 64 * 1024
	argonThreads = 4
	argonKeyLen  = 32
)

var emailRe = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

// EmailRe exports the email format check used for validation.
func EmailValid(email string) bool {
	return emailRe.MatchString(email)
}

// PasswordValid mirrors the prototype's rule: at least 8 characters.
func PasswordValid(password string) bool {
	return len(password) >= 8
}

// HashPassword returns an encoded argon2id hash.
func HashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	encoded := base64.RawStdEncoding.EncodeToString(hash)
	saltEnc := base64.RawStdEncoding.EncodeToString(salt)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads, saltEnc, encoded), nil
}

// VerifyPassword checks a password against an encoded argon2id hash.
func VerifyPassword(encoded, password string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, errors.New("auth: unsupported hash format")
	}
	var version int
	_, err := fmt.Sscanf(parts[2], "v=%d", &version)
	if err != nil {
		return false, err
	}
	var memory, timeCost uint32
	var threads uint8
	_, err = fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &timeCost, &threads)
	if err != nil {
		return false, err
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, err
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, err
	}
	got := argon2.IDKey([]byte(password), salt, timeCost, memory, threads, uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1, nil
}

// NewToken returns a cryptographically random URL-safe session token.
func NewToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// RandomToken returns a fresh opaque random token without forcing callers to
// handle the (effectively impossible) entropy failure, for one-time values
// such as a substitute password for accounts linked to Google.
func RandomToken() string {
	t, _ := NewToken()
	return t
}
