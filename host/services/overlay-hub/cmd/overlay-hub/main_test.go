package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOkHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/v1/register", nil)
	w := httptest.NewRecorder()
	okHandler(w, req)
	if w.Result().StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Result().StatusCode)
	}
}
