package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/claims"
)

// TestClaimsLifecycle covers creation, watching, and fulfilment.
func TestClaimsLifecycle(t *testing.T) {
	cs := claims.NewServer(auth)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/claims/new", nil)
	cs.HandleNew(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("new status %d", rr.Code)
	}
	var resp map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	id, tok := resp["id"], resp["token"]
	if id == "" || tok == "" {
		t.Fatal("missing id or token")
	}

	watchRec := httptest.NewRecorder()
	watchReq := httptest.NewRequest(http.MethodGet, "/api/claims/"+id+"/watch", nil)
	done := make(chan struct{})
	go func() {
		cs.HandleWatch(watchRec, watchReq)
		close(done)
	}()

	fulfilReqBody := fmt.Sprintf(`{"id":"%s","token":"%s"}`, id, tok)
	fulfRec := httptest.NewRecorder()
	fulfReq := httptest.NewRequest(http.MethodPost, "/api/claims/fulfill", strings.NewReader(fulfilReqBody))
	cs.HandleFulfill(fulfRec, fulfReq)
	if fulfRec.Code != http.StatusNoContent {
		t.Fatalf("fulfill status %d", fulfRec.Code)
	}

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("watch timeout")
	}
	if !strings.Contains(watchRec.Body.String(), "fulfilled") {
		t.Fatalf("watch body %q", watchRec.Body.String())
	}
}
