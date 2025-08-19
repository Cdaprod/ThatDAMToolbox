package claims

// Package claims implements a lightweight in-memory token claim store.
//
// The store is intentionally ephemeral and suitable for tests. It
// generates opaque claim IDs and tokens and exposes methods to watch
// and fulfil claims.
//
// Example:
//
//  cs := claims.NewStore()
//  id, token := cs.New()
//  go func() { <-cs.Watch(id); fmt.Println("fulfilled") }()
//  cs.Fulfill(id, token)
//
// All operations are safe for concurrent use.

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
)

// Claim represents an issuance awaiting fulfilment.
type Claim struct {
	ID        string
	Token     string
	Fulfilled bool
	ch        chan struct{}
}

// Store keeps claims in memory.
type Store struct {
	mu     sync.RWMutex
	claims map[string]*Claim
}

// NewStore constructs an empty store.
func NewStore() *Store {
	return &Store{claims: make(map[string]*Claim)}
}

// New creates a fresh claim and returns its ID and token.
func (s *Store) New() (string, string) {
	id := randHex(16)
	token := randHex(16)
	c := &Claim{ID: id, Token: token, ch: make(chan struct{})}
	s.mu.Lock()
	s.claims[id] = c
	s.mu.Unlock()
	return id, token
}

// Fulfill marks the claim done if the token matches.
func (s *Store) Fulfill(id, token string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.claims[id]
	if !ok || c.Token != token || c.Fulfilled {
		return false
	}
	c.Fulfilled = true
	close(c.ch)
	return true
}

// Watch returns a channel closed once the claim is fulfilled.
func (s *Store) Watch(id string) (<-chan struct{}, bool) {
	s.mu.RLock()
	c, ok := s.claims[id]
	s.mu.RUnlock()
	if !ok {
		return nil, false
	}
	if c.Fulfilled {
		ch := make(chan struct{})
		close(ch)
		return ch, true
	}
	return c.ch, true
}

func randHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
