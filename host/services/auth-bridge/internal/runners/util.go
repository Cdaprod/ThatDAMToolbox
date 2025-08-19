// Package runners provides utilities for runner registration scripts.
package runners

import (
	"crypto/rand"
	"encoding/hex"
	"log"
)

// GenerateToken returns a random 16-byte hex token.
// Example:
//
//	t, err := runners.GenerateToken()
//	fmt.Println(t, err)
func GenerateToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// ApplySupervisorFlags is a stub for integration with supervisor feature toggling.
func ApplySupervisorFlags(profile string) {
	log.Printf("supervisor features toggled for profile=%s", profile)
}
