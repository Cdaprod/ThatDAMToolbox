package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRegisterHeartbeat(t *testing.T) {
	reg = NewRegistry()
	apiKey = ""

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewBufferString(`{"id":"a1"}`))
	registerHandler(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("register status %d", rr.Code)
	}
	snap := reg.Snapshot()
	if len(snap) != 1 || snap[0].Status != "registered" {
		t.Fatalf("unexpected registry %+v", snap)
	}

	rr = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/heartbeat", bytes.NewBufferString(`{"id":"a1"}`))
	heartbeatHandler(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("heartbeat status %d", rr.Code)
	}
	snap = reg.Snapshot()
	if snap[0].Status != "healthy" {
		t.Fatalf("expected healthy, got %s", snap[0].Status)
	}

	reg.MarkStale(time.Nanosecond)
	snap = reg.Snapshot()
	if snap[0].Status != "stale" {
		t.Fatalf("expected stale, got %s", snap[0].Status)
	}
}
