package handshake

import (
	"context"
	"time"
)

// Discovery-side FSM stubs (no internals), to be called early in main().
// Example usage: go run .

func runHandshake(ctx context.Context) error {
	// TODO: load/generate node_id, locate control plane (mDNS, CLOUD_CONTROL_URL, tailscale)
	// TODO: if found -> register, request plan, apply; else -> self-elect leader
	return nil
}

func applyPlan(ctx context.Context, plan any) error {
	// TODO: write cluster.json atomically, (re)start/stop local services to match services[]
	return nil
}

func sendHeartbeatLoop(ctx context.Context, interval time.Duration) {
	// TODO: POST /v1/nodes/heartbeat every ttl/3, handle 401/403/404 by re-registering
}

func selfElectLeader(ctx context.Context) error {
	// TODO: set role=leader, epoch++, advertise mDNS, write cluster.json
	return nil
}
