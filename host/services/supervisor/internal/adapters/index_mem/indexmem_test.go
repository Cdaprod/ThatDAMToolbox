package indexmem

import (
	"context"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

// TestUpsert ensures vectors are stored.
func TestUpsert(t *testing.T) {
	idx := New()
	ctx := context.Background()
	cls := ports.ClassSpec{Name: "doc"}
	if err := idx.EnsureClass(ctx, cls); err != nil {
		t.Fatalf("class: %v", err)
	}
	props := []ports.PropertySpec{{Name: "title", Type: "text"}}
	if err := idx.EnsureProperties(ctx, "doc", props); err != nil {
		t.Fatalf("props: %v", err)
	}
	vec := []float32{0.1, 0.2}
	if err := idx.UpsertVector(ctx, "doc", "id1", vec, map[string]any{"k": "v"}); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if got, _, ok := idx.GetVector("doc", "id1"); !ok || len(got) != 2 {
		t.Fatalf("vector missing")
	}
}
