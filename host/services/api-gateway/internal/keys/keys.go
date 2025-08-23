package keys

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"os"
	"sync"

	"github.com/lestrrat-go/jwx/v2/jwk"
)

var (
	privOnce sync.Once
	privKey  *rsa.PrivateKey
	kid      = "k1" // rotate by changing this
)

// privateKey returns the RSA private key used for signing. If AUTH_PRIVATE_KEY_PEM
// is set, a parsed key should be returned (not implemented). Otherwise an
// ephemeral key is generated. Example:
//
//	_ = os.Setenv("AUTH_PRIVATE_KEY_PEM", myPEM)
//	k := PrivateForSign()
func privateKey() *rsa.PrivateKey {
	privOnce.Do(func() {
		if pem := os.Getenv("AUTH_PRIVATE_KEY_PEM"); pem != "" {
			// TODO: parse PEM -> *rsa.PrivateKey; falling back to generated
		}
		key, _ := rsa.GenerateKey(rand.Reader, 2048)
		privKey = key
	})
	return privKey
}

// CurrentKID returns the identifier for the current signing key.
func CurrentKID() string { return kid }

// PublicJWKSJSON returns the JSON encoded JWKS public set.
// Example: http.HandleFunc("/.well-known/jwks.json", JWKSHandler)
func PublicJWKSJSON() []byte {
	j, _ := jwk.FromRaw(&privateKey().PublicKey)
	_ = j.Set(jwk.KeyIDKey, kid)
	_ = j.Set(jwk.AlgorithmKey, "RS256")
	set := jwk.NewSet()
	_ = set.AddKey(j)
	b, _ := json.Marshal(set)
	return b
}

// PrivateForSign exposes the RSA private key for token signing.
func PrivateForSign() *rsa.PrivateKey { return privateKey() }
