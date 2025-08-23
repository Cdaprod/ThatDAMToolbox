package tokens

import (
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/api-gateway/internal/keys"
	"github.com/golang-jwt/jwt/v5"
)

const (
	issuer = "https://auth.thatdamtoolbox.cloud"
	aud    = "thatdamtoolbox"
)

// Claims represents the custom JWT claims for all token types.
type Claims struct {
	Typ      string   `json:"typ"`
	TenantID string   `json:"tenant_id"`
	Roles    []string `json:"roles"`
	Scopes   []string `json:"scopes"`
	jwt.RegisteredClaims
}

func sign(cl *Claims, ttl time.Duration) (string, error) {
	now := time.Now()
	cl.RegisteredClaims = jwt.RegisteredClaims{
		Issuer:    issuer,
		Audience:  jwt.ClaimStrings{aud},
		Subject:   cl.Subject,
		ID:        cl.ID,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, cl)
	token.Header["kid"] = keys.CurrentKID()
	return token.SignedString(keys.PrivateForSign())
}

// SignPAT issues a platform access token for a user.
// Example:
//
//	t, _ := SignPAT("user_1", "tenant", []string{"admin"}, []string{"ui:*"})
func SignPAT(userSub, tenant string, roles, scopes []string) (string, error) {
	return sign(&Claims{
		Typ:      "pat",
		TenantID: tenant,
		Roles:    roles,
		Scopes:   scopes,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject: userSub,
		},
	}, 30*time.Minute)
}

// SignNJT issues a node join token.
func SignNJT(deviceID, tenant string) (string, error) {
	return sign(&Claims{
		Typ:      "njt",
		TenantID: tenant,
		Scopes:   []string{"node:join"},
		RegisteredClaims: jwt.RegisteredClaims{
			Subject: "device_" + deviceID,
		},
	}, 10*time.Minute)
}

// SignNAT issues a node access token with provided scopes.
func SignNAT(nodeID, tenant string, scopes []string) (string, error) {
	return sign(&Claims{
		Typ:      "nat",
		TenantID: tenant,
		Scopes:   scopes,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject: "node_" + nodeID,
		},
	}, 30*time.Minute)
}
