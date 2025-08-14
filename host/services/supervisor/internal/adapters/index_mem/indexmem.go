package indexmem

// Package indexmem provides an in-memory VectorIndex adapter.
//
// Example usage:
//   idx := indexmem.New()
//   _ = idx.EnsureClass(ctx, ports.ClassSpec{Name: "doc"})
//   _ = idx.UpsertVector(ctx, "doc", "id1", []float32{0.1}, nil)

import (
	"context"
	"errors"
	"sync"

	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

type vectorData struct {
	vector []float32
	meta   map[string]any
}

// InMemoryIndex stores classes and vectors in maps.
type InMemoryIndex struct {
	mu      sync.Mutex
	classes map[string]ports.ClassSpec
	vectors map[string]map[string]vectorData
}

// New constructs an empty in-memory index.
func New() *InMemoryIndex {
	return &InMemoryIndex{
		classes: make(map[string]ports.ClassSpec),
		vectors: make(map[string]map[string]vectorData),
	}
}

// EnsureClass creates the class if absent.
func (i *InMemoryIndex) EnsureClass(ctx context.Context, c ports.ClassSpec) error {
	i.mu.Lock()
	defer i.mu.Unlock()
	if _, ok := i.classes[c.Name]; !ok {
		i.classes[c.Name] = c
	}
	return nil
}

// EnsureProperties adds missing properties to a class.
func (i *InMemoryIndex) EnsureProperties(ctx context.Context, class string, props []ports.PropertySpec) error {
	i.mu.Lock()
	defer i.mu.Unlock()
	cls, ok := i.classes[class]
	if !ok {
		return errors.New("class not found")
	}
	existing := make(map[string]ports.PropertySpec)
	for _, p := range cls.Properties {
		existing[p.Name] = p
	}
	for _, p := range props {
		if _, ok := existing[p.Name]; !ok {
			cls.Properties = append(cls.Properties, p)
		}
	}
	i.classes[class] = cls
	return nil
}

// UpsertVector stores or replaces a vector for the given class and id.
func (i *InMemoryIndex) UpsertVector(ctx context.Context, class, id string, vec []float32, meta map[string]any) error {
	i.mu.Lock()
	defer i.mu.Unlock()
	if _, ok := i.vectors[class]; !ok {
		i.vectors[class] = make(map[string]vectorData)
	}
	i.vectors[class][id] = vectorData{vector: vec, meta: meta}
	return nil
}

// GetVector retrieves a stored vector, used in tests.
func (i *InMemoryIndex) GetVector(class, id string) ([]float32, map[string]any, bool) {
	i.mu.Lock()
	defer i.mu.Unlock()
	m, ok := i.vectors[class]
	if !ok {
		return nil, nil, false
	}
	v, ok := m[id]
	if !ok {
		return nil, nil, false
	}
	return v.vector, v.meta, true
}
