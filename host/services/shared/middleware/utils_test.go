package middleware

import (
	"testing"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
)

type testClaims struct {
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func makeToken(secret, id, username, role string, exp time.Time) (string, error) {
	claims := testClaims{
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   id,
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func TestValidateJWTValid(t *testing.T) {
	secret := "testsecret"
	token, err := makeToken(secret, "123", "alice", "user", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	user, err := validateJWT(token, secret)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if user.ID != "123" || user.Username != "alice" || user.Role != "user" {
		t.Fatalf("unexpected user: %+v", user)
	}
}

func TestValidateJWTExpired(t *testing.T) {
	secret := "testsecret"
	token, err := makeToken(secret, "123", "alice", "user", time.Now().Add(-time.Hour))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	if _, err := validateJWT(token, secret); err == nil {
		t.Fatal("expected error for expired token")
	}
}

func TestValidateJWTTampered(t *testing.T) {
	token, err := makeToken("othersecret", "123", "alice", "user", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	if _, err := validateJWT(token, "testsecret"); err == nil {
		t.Fatal("expected error for tampered token")
	}
}
