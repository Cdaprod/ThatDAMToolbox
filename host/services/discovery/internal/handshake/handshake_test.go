package handshake

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
)

// helper to read persisted state
func readState(t *testing.T, dir string) clusterState {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(dir, "cluster.json"))
	if err != nil {
		t.Fatalf("read state: %v", err)
	}
	var s clusterState
	if err := json.Unmarshal(b, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	return s
}

func TestRunHandshakeRegistersAndAppliesPlan(t *testing.T) {
	logx.Init(logx.Config{})
	tmp := t.TempDir()
	t.Setenv("DISCOVERY_DATA_DIR", tmp)

	var registerCalls, heartbeatCalls int32
	heartbeatCh := make(chan struct{}, 1)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/nodes/register":
			atomic.AddInt32(&registerCalls, 1)
			fmt.Fprint(w, `{"node_id":"test-node","ttl":1}`)
		case "/v1/nodes/plan":
			fmt.Fprint(w, `{"role":"agent","services":["svc1"]}`)
		case "/v1/nodes/heartbeat":
			if atomic.AddInt32(&heartbeatCalls, 1) == 1 {
				heartbeatCh <- struct{}{}
			}
			w.WriteHeader(http.StatusOK)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	t.Setenv("SUPERVISOR_URL", srv.URL)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := runHandshake(ctx); err != nil {
		t.Fatalf("runHandshake: %v", err)
	}

	select {
	case <-heartbeatCh:
	case <-time.After(2 * time.Second):
		t.Fatal("heartbeat not received")
	}
	cancel()
	time.Sleep(100 * time.Millisecond)

	st := readState(t, tmp)
	if st.NodeID != "test-node" || st.Role != "agent" {
		t.Fatalf("unexpected state: %+v", st)
	}
	if c := atomic.LoadInt32(&registerCalls); c != 1 {
		t.Fatalf("expected 1 register call, got %d", c)
	}
}

func TestHeartbeatTriggersReRegistration(t *testing.T) {
	logx.Init(logx.Config{})
	tmp := t.TempDir()
	t.Setenv("DISCOVERY_DATA_DIR", tmp)

	var registerCalls int32
	var hbCount int32
	done := make(chan struct{}, 1)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/nodes/register":
			atomic.AddInt32(&registerCalls, 1)
			fmt.Fprint(w, `{"node_id":"test-node","ttl":1}`)
		case "/v1/nodes/plan":
			fmt.Fprint(w, `{"role":"agent"}`)
		case "/v1/nodes/heartbeat":
			if atomic.AddInt32(&hbCount, 1) == 1 {
				w.WriteHeader(http.StatusUnauthorized)
			} else {
				w.WriteHeader(http.StatusOK)
				done <- struct{}{}
			}
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	t.Setenv("SUPERVISOR_URL", srv.URL)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := runHandshake(ctx); err != nil {
		t.Fatalf("runHandshake: %v", err)
	}

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("re-registration heartbeat not observed")
	}
	cancel()
	time.Sleep(100 * time.Millisecond)

	if c := atomic.LoadInt32(&registerCalls); c < 2 {
		t.Fatalf("expected re-registration, got %d", c)
	}
}

func TestSelfElectLeader(t *testing.T) {
	logx.Init(logx.Config{})
	tmp := t.TempDir()
	t.Setenv("DISCOVERY_DATA_DIR", tmp)
	s := clusterState{NodeID: "n1", Epoch: 1}
	if err := saveState(s); err != nil {
		t.Fatalf("saveState: %v", err)
	}
	if err := selfElectLeader(context.Background()); err != nil {
		t.Fatalf("selfElectLeader: %v", err)
	}
	st := readState(t, tmp)
	if st.Role != "leader" || st.Epoch != 2 {
		t.Fatalf("unexpected state: %+v", st)
	}
}
