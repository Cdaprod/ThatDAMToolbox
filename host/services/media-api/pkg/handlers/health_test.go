// /host/services/media-api/pkg/handlers/health_test.go
package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestHealth ensures the health endpoint returns HTTP 200.
func TestHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v2/health", nil)
	w := httptest.NewRecorder()

	Health(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
