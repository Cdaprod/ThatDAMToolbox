package bootstrap

import (
	"context"
	"errors"
	"testing"
)

type mockEngine struct {
	profile any
	err     error
	called  bool
}

func (m *mockEngine) Apply(ctx context.Context, profile any) error {
	m.called = true
	m.profile = profile
	return m.err
}

func TestApplyRequiresEngine(t *testing.T) {
	if err := Apply(context.Background(), nil, nil); err == nil {
		t.Fatal("expected error when engine is nil")
	}
}

func TestApplyDelegatesToEngine(t *testing.T) {
	m := &mockEngine{}
	prof := struct{ Name string }{"test"}
	if err := Apply(context.Background(), m, prof); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !m.called || m.profile != prof {
		t.Fatalf("engine not called with profile: %+v", m.profile)
	}
}

func TestApplyPropagatesError(t *testing.T) {
	want := errors.New("boom")
	m := &mockEngine{err: want}
	if err := Apply(context.Background(), m, nil); !errors.Is(err, want) {
		t.Fatalf("expected %v, got %v", want, err)
	}
}

func TestNewAdaptersIncludesRuntime(t *testing.T) {
	adapters, err := NewAdapters(context.Background())
	if err != nil {
		t.Fatalf("NewAdapters returned error: %v", err)
	}
	if adapters.Runtime == nil {
		t.Fatalf("expected runtime adapter")
	}
}

func TestChooseRuntime(t *testing.T) {
	if rt := ChooseRuntime(); rt == nil {
		t.Fatalf("expected non-nil runtime")
	}
}
