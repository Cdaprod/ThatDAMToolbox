// Package runners logs runner registrations.
package runners

import (
	"sync"
	"time"
)

// RunnerRegistration represents a minimal log entry for a runner script request.
type RunnerRegistration struct {
	ID      string
	Profile string
	Created time.Time
}

// RunnerStore logs runner registration metadata.
type RunnerStore interface {
	Log(RunnerRegistration) error
}

// memoryStore is an in-memory RunnerStore used for demos and tests.
type memoryStore struct {
	mu   sync.Mutex
	logs []RunnerRegistration
}

func (m *memoryStore) Log(r RunnerRegistration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.logs = append(m.logs, r)
	return nil
}

// NewMemoryStore returns a thread-safe in-memory store.
func NewMemoryStore() RunnerStore { return &memoryStore{} }
