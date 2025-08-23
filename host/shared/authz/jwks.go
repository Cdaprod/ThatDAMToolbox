package authz

import (
	"context"
	"errors"

	"github.com/golang-jwt/jwt/v5"
	"github.com/lestrrat-go/jwx/v2/jwk"
)

var set jwk.Set

// InitJWKS fetches a JWKS from the given URL.
// Example:
//
//	_ = authz.InitJWKS("https://api.example/.well-known/jwks.json")
func InitJWKS(url string) error {
	s, err := jwk.Fetch(context.Background(), url)
	if err != nil {
		return err
	}
	set = s
	return nil
}

// Keyfunc returns a jwt.Keyfunc backed by the loaded JWKS.
func Keyfunc() (jwt.Keyfunc, error) {
	if set == nil {
		return nil, errors.New("jwks not initialized")
	}
	return func(token *jwt.Token) (interface{}, error) {
		kid, _ := token.Header["kid"].(string)
		if key, ok := set.LookupKeyID(kid); ok {
			var v interface{}
			if err := key.Raw(&v); err != nil {
				return nil, err
			}
			return v, nil
		}
		return nil, errors.New("unknown kid")
	}, nil
}
