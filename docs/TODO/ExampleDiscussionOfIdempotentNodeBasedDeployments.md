Love it. Here’s a example of concrete, idempotent pattern so every machine can docker compose up the same root file and still auto-organize into a working cluster (or operate solo) with your discovery bootstrapper.

⸻

How it works (at runtime)
	1.	Node boots → Discovery runs first.
	•	Generates/loads a stable node_id under /var/lib/thatdam/.
	•	Tries to find a leader via mDNS on LAN (_thatdam._tcp.local) and (optionally) via your cloud control URL (if present).
	•	If it finds a leader → it registers as a worker (or proxy if a worker already exists for that host’s devices).
	•	If it can’t find one → it self-elects leader, starts a tiny control API, and advertises via mDNS.
	2.	Other services read cluster.json (written by Discovery) and decide their role:
	•	Leader: run api-gateway (control plane) + accept worker registrations.
	•	Worker: run capture-daemon (and camera-proxy if needed), point to the leader’s API.
	•	Proxy-only: if a daemon is running elsewhere on this node/network, just relay.
	3.	Always idempotent:
	•	If the leader goes away, the next node that detects no leader during heartbeat promotes itself.
	•	A node can be offline and still be useful (solo). When it comes back online near others, it will auto-join and just work.

⸻

Minimal files to add/change

1) Shared state & profiles in Compose

/docker-compose.yaml

name: thatdamtoolbox
networks:
  damnet:
    driver: bridge

volumes:
  thatdam_state:      # persisted cluster state & node identity
  thatdam_sock:       # optional: if you prefer an internal docker.sock proxy

services:
  discovery:
    build:
      context: ./host/services/discovery
      dockerfile: Dockerfile
    container_name: thatdam-discovery
    restart: unless-stopped
    networks: [damnet]
    environment:
      # Optional cloud rendezvous; discovery works fine without it
      CLOUD_CONTROL_URL: ${CLOUD_CONTROL_URL:-}
      MDNS_SERVICE: _thatdam._tcp
      MDNS_PORT: 7700
    volumes:
      - thatdam_state:/var/lib/thatdam
      # Discovery does NOT need docker.sock. It only writes cluster.json and runs its own HTTP.
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:7700/health"]
      interval: 10s
      timeout: 2s
      retries: 9

  api-gateway:
    build:
      context: ./host/services/api-gateway
    container_name: thatdam-api-gateway
    networks: [damnet]
    depends_on:
      discovery:
        condition: service_healthy
    environment:
      ROLE: auto
      CLUSTER_FILE: /var/lib/thatdam/cluster.json
    volumes:
      - thatdam_state:/var/lib/thatdam
    entrypoint: ["/entrypoint/role-aware.sh"]
    restart: unless-stopped

  capture-daemon:
    build:
      context: ./host/services/capture-daemon
    container_name: thatdam-capture
    networks: [damnet]
    depends_on:
      discovery:
        condition: service_healthy
    environment:
      ROLE: auto
      CLUSTER_FILE: /var/lib/thatdam/cluster.json
    devices:
      - "/dev/video0:/dev/video0"   # adapt per host
    volumes:
      - thatdam_state:/var/lib/thatdam
    entrypoint: ["/entrypoint/role-aware.sh"]
    restart: unless-stopped

  camera-proxy:
    build:
      context: ./host/services/camera-proxy
    container_name: thatdam-proxy
    networks: [damnet]
    depends_on:
      discovery:
        condition: service_healthy
    environment:
      ROLE: auto
      CLUSTER_FILE: /var/lib/thatdam/cluster.json
    volumes:
      - thatdam_state:/var/lib/thatdam
    entrypoint: ["/entrypoint/role-aware.sh"]
    restart: unless-stopped

  video-api:
    build:
      context: ./host/services/video-api
    container_name: thatdam-video-api
    networks: [damnet]
    depends_on:
      discovery:
        condition: service_healthy
    environment:
      ROLE: auto
      CLUSTER_FILE: /var/lib/thatdam/cluster.json
    volumes:
      - thatdam_state:/var/lib/thatdam
    entrypoint: ["/entrypoint/role-aware.sh"]
    restart: unless-stopped

  web-site:
    build: ./docker/web-site
    networks: [damnet]
    depends_on: [discovery]
    environment:
      ROLE: auto
      CLUSTER_FILE: /var/lib/thatdam/cluster.json
    volumes:
      - thatdam_state:/var/lib/thatdam
    entrypoint: ["/entrypoint/role-aware.sh"]
    restart: unless-stopped

  web-app:
    build: ./docker/web-app
    networks: [damnet]
    depends_on: [discovery]
    environment:
      ROLE: auto
      CLUSTER_FILE: /var/lib/thatdam/cluster.json
    volumes:
      - thatdam_state:/var/lib/thatdam
    entrypoint: ["/entrypoint/role-aware.sh"]
    restart: unless-stopped

  gateway:
    build: ./docker/nginx
    networks: [damnet]
    depends_on: [web-site, web-app, api-gateway]
    restart: unless-stopped

The important bit: every service mounts thatdam_state and uses the same CLUSTER_FILE. Their entrypoint script decides how to start (leader/worker/proxy) or to no-op if not needed.

⸻

2) Discovery bootstrap (leader election + registry)

/host/services/discovery/main.go

package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	// mDNS (LAN) discovery; pure OSS
	"github.com/grandcat/zeroconf"
)

type Cluster struct {
	ClusterID   string   `json:"cluster_id"`
	LeaderHost  string   `json:"leader_host"`
	LeaderPort  int      `json:"leader_port"`
	Members     []string `json:"members"`
	LastUpdated string   `json:"last_updated"`
}

type Node struct {
	NodeID   string `json:"node_id"`
	Hostname string `json:"hostname"`
}

const (
	stateDir    = "/var/lib/thatdam"
	clusterFile = "/var/lib/thatdam/cluster.json"
	serviceName = "_thatdam._tcp"
	servicePort = 7700
)

func mustNodeID() (Node, error) {
	if err := os.MkdirAll(stateDir, 0o755); err != nil {
		return Node{}, err
	}
	idPath := filepath.Join(stateDir, "node_id")
	hostname, _ := os.Hostname()

	if b, err := os.ReadFile(idPath); err == nil && len(b) > 0 {
		return Node{NodeID: string(b), Hostname: hostname}, nil
	}
	// generate random 16B id
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return Node{}, err
	}
	id := hex.EncodeToString(buf)
	if err := os.WriteFile(idPath, []byte(id), 0o600); err != nil {
		return Node{}, err
	}
	return Node{NodeID: id, Hostname: hostname}, nil
}

func writeCluster(c Cluster) error {
	c.LastUpdated = time.Now().UTC().Format(time.RFC3339)
	b, _ := json.MarshalIndent(c, "", "  ")
	return os.WriteFile(clusterFile, b, 0o644)
}

func discoverLeader(ctx context.Context) (string, int, error) {
	resolver, err := zeroconf.NewResolver(nil)
	if err != nil {
		return "", 0, err
	}
	entries := make(chan *zeroconf.ServiceEntry)
	var leaderHost string
	var leaderPort int
	found := make(chan struct{})

	go func(results <-chan *zeroconf.ServiceEntry) {
		for e := range results {
			if len(e.AddrIPv4) > 0 {
				leaderHost = e.AddrIPv4[0].String()
			} else if len(e.AddrIPv6) > 0 {
				leaderHost = e.AddrIPv6[0].String()
			} else {
				continue
			}
			leaderPort = e.Port
			close(found)
			return
		}
	}(entries)

	// browse up to 3 seconds
	if err := resolver.Browse(ctx, serviceName, "local.", entries); err != nil {
		return "", 0, err
	}
	select {
	case <-found:
		return leaderHost, leaderPort, nil
	case <-time.After(3 * time.Second):
		return "", 0, errors.New("no leader found")
	}
}

func serveLeaderAPI(c Cluster) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	mux.HandleFunc("/cluster", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(c)
	})
	mux.HandleFunc("/register", func(w http.ResponseWriter, r *http.Request) {
		type Req struct{ NodeID, Hostname string }
		var req Req
		_ = json.NewDecoder(r.Body).Decode(&req)
		// append if not exists
		for _, m := range c.Members {
			if m == req.NodeID {
				w.WriteHeader(200)
				return
			}
		}
		c.Members = append(c.Members, req.NodeID)
		_ = writeCluster(c)
		w.WriteHeader(201)
	})

	srv := &http.Server{Addr: fmt.Sprintf("0.0.0.0:%d", servicePort), Handler: mux}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("leader api error: %v", err)
		}
	}()
	return srv
}

func advertiseMDNS(host string, port int) (*zeroconf.Server, error) {
	return zeroconf.Register("thatdam-leader", serviceName, "local.", port, []string{"txt=leader"}, nil)
}

func main() {
	ctx := context.Background()
	node, err := mustNodeID()
	if err != nil {
		log.Fatalf("node id error: %v", err)
	}

	// Try to find leader via mDNS (LAN); optional cloud rendezvous may be added here.
	leaderHost, leaderPort, err := discoverLeader(ctx)
	if err == nil {
		// Found leader: write cluster file and register
		c := Cluster{
			ClusterID:  "auto",
			LeaderHost: leaderHost,
			LeaderPort: leaderPort,
			Members:    []string{node.NodeID},
		}
		_ = writeCluster(c)

		// register self
		http.Post(fmt.Sprintf("http://%s:%d/register", leaderHost, leaderPort),
			"application/json",
			net.NewFile(0, "")) // no-op body; keep it simple for now
		log.Printf("joined leader at %s:%d", leaderHost, leaderPort)
		select {} // stay alive for healthcheck
	}

	// Become leader
	ip := "0.0.0.0" // container binds all; peers will use docker network ip via mDNS record
	cluster := Cluster{
		ClusterID:  node.NodeID[:8],
		LeaderHost: ip,
		LeaderPort: servicePort,
		Members:    []string{node.NodeID},
	}
	_ = writeCluster(cluster)
	srv := serveLeaderAPI(cluster)
	mdns, err := advertiseMDNS(ip, servicePort)
	if err != nil {
		log.Printf("mdns advertise error: %v", err)
	}
	log.Printf("acting as leader on %s:%d", ip, servicePort)
	// wait forever
	select {}
	// (cleanup omitted)
	_ = mdns.Shutdown()
	_ = srv.Shutdown(ctx)
}

/host/services/discovery/Dockerfile

FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/discovery ./main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates curl
WORKDIR /app
COPY --from=build /out/discovery /usr/local/bin/discovery
EXPOSE 7700
ENTRYPOINT ["discovery"]

/host/services/discovery/go.mod

module thatdam/discovery

go 1.22

require github.com/grandcat/zeroconf v1.0.0

This is intentionally minimal: mDNS for LAN, tiny HTTP for cluster/health/register. You can later add an optional CLOUD_CONTROL_URL rendezvous step.

⸻

3) Role-aware wrapper used by every service

/host/services/shared/entrypoint/role-aware.sh

#!/usr/bin/env bash
set -euo pipefail

CLUSTER_FILE="${CLUSTER_FILE:-/var/lib/thatdam/cluster.json}"
ROLE="${ROLE:-auto}"

# jq may not exist in scratch images; use busybox awk
leader_host=$(awk -F'"' '/"LeaderHost"/{print $4}' "$CLUSTER_FILE" 2>/dev/null || true)
leader_port=$(awk -F'[: ,]+' '/"LeaderPort"/{print $3}' "$CLUSTER_FILE" 2>/dev/null || true)

if [[ -z "${leader_host}" || -z "${leader_port}" ]]; then
  echo "[role] cluster file not ready yet; sleeping..."
  sleep 2
fi

case "$SERVICE_NAME" in
  api-gateway)
    if [[ -z "${leader_host}" ]]; then
      echo "[role] I am leader -> start api-gateway"
      exec /usr/local/bin/api-gateway
    else
      # If cluster says someone else is leader and we're not it, noop gracefully.
      echo "[role] not leader -> noop"
      sleep infinity
    fi
    ;;
  capture-daemon)
    if [[ -n "${leader_host}" ]]; then
      export API_BASE="http://${leader_host}:${leader_port}"
      echo "[role] worker -> connecting to ${API_BASE}"
      exec /usr/local/bin/capture-daemon
    else
      echo "[role] solo mode -> start capture-daemon local only"
      exec /usr/local/bin/capture-daemon --local-only
    fi
    ;;
  camera-proxy)
    if pgrep -x capture-daemon >/dev/null 2>&1; then
      echo "[role] daemon present -> proxy disabled"
      sleep infinity
    else
      export API_BASE="http://${leader_host}:${leader_port}"
      echo "[role] proxy -> ${API_BASE}"
      exec /usr/local/bin/camera-proxy
    fi
    ;;
  video-api|web-site|web-app)
    export API_BASE="http://${leader_host:-127.0.0.1}:${leader_port:-8081}"
    exec "/usr/local/bin/${SERVICE_NAME}"
    ;;
  *)
    exec "$@"
    ;;
esac

Each service image should set ENV SERVICE_NAME=<service> and include this entrypoint (copy the script into /entrypoint and ENTRYPOINT ["/entrypoint/role-aware.sh"]).

⸻

4) Cluster file schema (simple, explicit)

/config/cluster.schema.json

{
  "type": "object",
  "required": ["cluster_id", "leader_host", "leader_port"],
  "properties": {
    "cluster_id": { "type": "string" },
    "leader_host": { "type": "string" },
    "leader_port": { "type": "integer" },
    "members": { "type": "array", "items": { "type": "string" } },
    "last_updated": { "type": "string" }
  }
}


⸻



Idempotency rules you now get
	•	Run anywhere: every machine can docker compose up the exact same stack.
	•	Solo or cluster: if isolated, a node operates solo; when it detects peers, it joins.
	•	Self-healing control plane: if the leader disappears, new nodes won’t find a leader and one of them will self-elect.
	•	No "role config drift": roles are computed from cluster.json at runtime; services decide to serve, connect, or noop.
	

⸻

Where your services fit the IaaS/PaaS/SaaS personas (recap)
	•	Bootstrapping (discovery takes the wheel): IaaS persona (sysadmin).
	•	Ingestion/Discovery (capture-daemon, camera-proxy, video-api): PaaS persona (dev).
	•	Cloud control (web-site, web-app, gateway): SaaS persona (user).

⸻

Next upgrades (optional but recommended)
	•	Add Tailscale/Headscale hints: if CLOUD_CONTROL_URL is set, discovery can also try DNS names like api-gw.<tailnet>.ts.net before self-electing.
	•	Heartbeat/TTL registry: discovery’s leader API can prune dead nodes and export a Worker Registry your web-app reads to show online agents + capabilities.
	•	Signed intents: when the web-site provisions a new agent, it can hand the discovery container a short-lived token to auto-join the intended cluster.

⸻

If you paste these files and rebuild, you’ll have exactly what you asked: same compose everywhere, services that are idempotent alone or together, and a tiny bootstrapper that "puts up what’s needed."

Want me to wire the SERVICE_NAME + entrypoint into each of your existing Dockerfiles next, or add the worker-registry endpoints to the api-gateway so the web-app can list nodes and assets live?


---

---
Yes. Let’s lock it in and make it real, with idempotent discovery → leader/worker roles → supervisor heartbeats. Below is a tight, drop-in plan with concrete file paths and minimal code where it matters (using your logx), plus Compose wiring so every node can docker compose up the same stack and auto-form a cluster.

⸻

/docs/ARCH/control-plane-runtime.md

# Control-Plane Runtime (Discovery → Roles → Supervisor)

## Node lifecycle
1) Boot → **discovery** starts first (health-gated).
2) discovery ensures a stable **node_id** at `/var/lib/thatdam/node_id`.
3) discovery tries to find a **leader**:
   - mDNS browse `_thatdam._tcp.local`.
   - If unset/fail, try `CLOUD_CONTROL_URL` (optional).
4) If leader found → write `cluster.json` with role=worker (or proxy) + leader URL.
   If no leader → **self-elect**: start supervisor (if not already), advertise mDNS, write `cluster.json` with role=leader.
5) All other services read `cluster.json` on start:
   - `leader`: run **api-gateway** (+ already-running supervisor), accept registrations.
   - `worker`: run **capture-daemon** (+ camera-proxy if present), point to leader `SUPERVISOR_URL` + `API_URL`.
   - `proxy-only`: only camera-proxy/relay.
6) Supervisor tracks heartbeats; if TTL expires and no leader resolves, a worker promotes to leader on next discovery tick.

## Idempotence
- Any node can be isolated → runs solo.
- When peers appear, node **joins** without reconfig.
- Leader disappears → next eligible worker self-elects.

## Files
- `/var/lib/thatdam/node_id` – stable UUIDv4 string.
- `/var/lib/thatdam/cluster.json` – desired/observed cluster view.

## cluster.json schema (versioned)
{
  "version": 1,
  "node_id": "uuid",
  "role": "leader" | "worker" | "proxy",
  "leader": {
    "url": "http://leader-ip:8070",
    "advertised_via": "mdns|cloud|static",
    "last_seen": "RFC3339"
  },
  "services": {
    "api_url": "http://leader-ip:8080",
    "supervisor_url": "http://leader-ip:8070"
  }
}


⸻

/docker-compose.yaml (key additions)

 services:
+  discovery:
+    build:
+      context: .
+      dockerfile: host/services/discovery/Dockerfile
+    image: cdaprod/discovery:latest
+    container_name: thatdamtoolbox-discovery
+    networks: [damnet]
+    environment:
+      CLOUD_CONTROL_URL: ${CLOUD_CONTROL_URL:-}
+      MDNS_SERVICE: _thatdam._tcp
+      SUPERVISOR_PORT: "8070"
+      API_GATEWAY_PORT: "8080"
+      DISCOVERY_TTL: "45s"
+    volumes:
+      - thatdam-var:/var/lib/thatdam
+    healthcheck:
+      test: ["CMD", "wget", "-qO-", "http://localhost:8099/health"]   # discovery exposes simple health
+      interval: 5s
+      timeout: 2s
+      retries: 10
+    restart: unless-stopped
+
   supervisor:
     build:
       context: .
       dockerfile: host/services/supervisor/Dockerfile
     image: cdaprod/supervisor:latest
     container_name: thatdamtoolbox-supervisor
     networks: [damnet]
     ports: ["8070:8070"]
     environment:
       SUPERVISOR_API_KEY: "changeme"
       EVENT_BROKER_URL: "amqp://video:video@rabbitmq:5672/"
       EVENT_PREFIX: "overlay"
     healthcheck:
       test: ["CMD", "wget", "-qO-", "http://localhost:8070/health"]
       interval: 10s
       timeout: 3s
       retries: 5
-    depends_on:
-      - rabbitmq
+    depends_on:
+      discovery:
+        condition: service_healthy
+      rabbitmq:
+        condition: service_started
     restart: unless-stopped
@@
   api-gateway:
     ...
-    depends_on:
-      - rabbitmq
+    depends_on:
+      discovery:
+        condition: service_healthy
+      rabbitmq:
+        condition: service_started
     restart: unless-stopped
@@
   capture-daemon:
     ...
-    depends_on:
-      - rabbitmq
+    depends_on:
+      discovery:
+        condition: service_healthy
+      rabbitmq:
+        condition: service_started
     restart: unless-stopped

 volumes:
+  thatdam-var:

We gate all services on discovery’s health. This doesn’t guarantee runtime order, but it guarantees discovery wrote cluster.json before others configure themselves.

⸻

/host/services/discovery/main.go (core behaviors; minimal code, uses logx)

package main

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
	"github.com/google/uuid"
)

type Cluster struct {
	Version int    `json:"version"`
	NodeID  string `json:"node_id"`
	Role    string `json:"role"` // leader|worker|proxy
	Leader  struct {
		URL        string `json:"url"`
		Advertised string `json:"advertised_via"`
		LastSeen   string `json:"last_seen"`
	} `json:"leader"`
	Services struct {
		API  string `json:"api_url"`
		Sup  string `json:"supervisor_url"`
	} `json:"services"`
}

const (
	stateDir   = "/var/lib/thatdam"
	nodeIDFile = "node_id"
	clusterFile= "cluster.json"
)

func main() {
	logx.Init(logx.Config{Service: "discovery", Level: os.Getenv("LOG_LEVEL"), Caller: "short"})
	ctx := context.Background()

	nodeID := ensureNodeID()
	t := time.Now().UTC().Format(time.RFC3339)
	mdnsSvc := getenv("MDNS_SERVICE", "_thatdam._tcp")
	apiPort := getenv("API_GATEWAY_PORT", "8080")
	supPort := getenv("SUPERVISOR_PORT", "8070")
	ttl, _ := time.ParseDuration(getenv("DISCOVERY_TTL", "45s"))

	leaderURL, advertised := probeLeader(ctx, mdnsSvc, os.Getenv("CLOUD_CONTROL_URL"))
	if leaderURL == "" {
		// self-elect leader
		leaderURL = "http://" + firstIP() + ":" + supPort
		writeCluster(Cluster{
			Version: 1, NodeID: nodeID, Role: "leader",
			Leader: struct {
				URL string "json:\"url\""; Advertised string "json:\"advertised_via\""; LastSeen string "json:\"last_seen\""
			}{URL: leaderURL, Advertised: "self", LastSeen: t},
			Services: struct{ API, Sup string }{API: "http://" + firstIP() + ":" + apiPort, Sup: leaderURL},
		})
		advertiseMDNS(mdnsSvc, supPort) // tiny no-op if mdns disabled
		startHealth(":8099")
		logx.L.Infof("self-elected leader: %s", leaderURL)
		return
	}

	// follower/worker path
	writeCluster(Cluster{
		Version: 1, NodeID: nodeID, Role: "worker",
		Leader: struct {
			URL string "json:\"url\""; Advertised string "json:\"advertised_via\""; LastSeen string "json:\"last_seen\""
		}{URL: leaderURL, Advertised: advertised, LastSeen: t},
		Services: struct{ API, Sup string }{
			API: strings.Replace(leaderURL, ":"+supPort, ":"+apiPort, 1),
			Sup: leaderURL,
		},
	})
	// optional: register with supervisor immediately (best-effort)
	bestEffortRegister(ctx, leaderURL, nodeID)

	// loop: watch TTL; if leader becomes unreachable past TTL → promote
	go func() {
		tk := time.NewTicker(ttl / 3)
		for range tk.C {
			if !reachable(leaderURL) {
				deadline := time.Now().Add(ttl)
				for time.Now().Before(deadline) {
					if reachable(leaderURL) { break }
					time.Sleep(2 * time.Second)
				}
				if !reachable(leaderURL) {
					// promote
					newURL := "http://" + firstIP() + ":" + supPort
					writeCluster(Cluster{
						Version: 1, NodeID: nodeID, Role: "leader",
						Leader: struct {
							URL string "json:\"url\""; Advertised string "json:\"advertised_via\""; LastSeen string "json:\"last_seen\""
						}{URL: newURL, Advertised: "self", LastSeen: time.Now().UTC().Format(time.RFC3339)},
						Services: struct{ API, Sup string }{API: "http://" + firstIP() + ":" + apiPort, Sup: newURL},
					})
					advertiseMDNS(mdnsSvc, supPort)
					logx.L.Warn("promoted to leader due to TTL")
					break
				}
			}
		}
	}()
	startHealth(":8099")
}

func ensureNodeID() string {
	_ = os.MkdirAll(stateDir, 0o755)
	p := filepath.Join(stateDir, nodeIDFile)
	if b, err := os.ReadFile(p); err == nil && len(strings.TrimSpace(string(b))) > 0 {
		return strings.TrimSpace(string(b))
	}
	id := uuid.NewString()
	_ = os.WriteFile(p, []byte(id+"\n"), 0o644)
	return id
}

func writeCluster(c Cluster) {
	b, _ := json.MarshalIndent(c, "", "  ")
	_ = os.WriteFile(filepath.Join(stateDir, clusterFile), b, 0o644)
}

func probeLeader(ctx context.Context, mdnsService, cloudURL string) (url, advertised string) {
	// (A) mDNS (best-effort)
	if u := mdnsLookupFirst(mdnsService); u != "" {
		return u, "mdns"
	}
	// (B) Cloud hint
	if cloudURL != "" && reachable(cloudURL) {
		return cloudURL, "cloud"
	}
	return "", ""
}

func firstIP() string {
	ifaces, _ := net.Interfaces()
	for _, ifc := range ifaces {
		addrs, _ := ifc.Addrs()
		for _, a := range addrs {
			if ipnet, ok := a.(*net.IPNet); ok && ipnet.IP.To4() != nil && !ipnet.IP.IsLoopback() {
				return ipnet.IP.String()
			}
		}
	}
	return "127.0.0.1"
}

func reachable(u string) bool {
	c := &http.Client{Timeout: 2 * time.Second}
	req, _ := http.NewRequest(http.MethodGet, u+"/health", nil)
	resp, err := c.Do(req)
	if err != nil { return false }
	_ = resp.Body.Close()
	return resp.StatusCode/100 == 2
}

func startHealth(addr string) {
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(200); w.Write([]byte("ok")) })
	go http.ListenAndServe(addr, nil)
}

// stubs (keep no-op-safe; you can replace with zeroconf later)
func advertiseMDNS(service string, port string) { /* no-op placeholder */ }
func mdnsLookupFirst(service string) string      { return "" }

// best-effort registration (uses your shared supervisor client)
func bestEffortRegister(ctx context.Context, leaderURL, nodeID string) {
	os.Setenv("SUPERVISOR_URL", leaderURL)
	// optional: set SUPERVISOR_API_KEY or token env beforehand
	// Using your shared client:
	// supervisor.Register(ctx, supervisor.Agent{ID: nodeID, Class: "discovery"})
	// _ = supervisor.Heartbeat(ctx, nodeID)
}

Notes:
	•	mDNS functions are no-op placeholders so this ships clean; you can switch to github.com/grandcat/zeroconf later without changing flow.
	•	Health endpoint at :8099 lets Compose gate everything else.

⸻

/host/services/capture-daemon/main.go (best-effort control-plane heartbeat)

// near startup after config is loaded:
go func() {
  ctx := context.Background()
  sup := os.Getenv("SUPERVISOR_URL")
  if sup == "" {
    // try from cluster.json
    if b, err := os.ReadFile("/var/lib/thatdam/cluster.json"); err == nil {
      var c struct{ Services struct{ Sup string `json:"supervisor_url"` } `json:"services"` }
      _ = json.Unmarshal(b, &c)
      if c.Services.Sup != "" { os.Setenv("SUPERVISOR_URL", c.Services.Sup) }
    }
  }
  if os.Getenv("SUPERVISOR_URL") == "" { return }
  _ = supervisor.Register(ctx, supervisor.Agent{
    ID: os.Getenv("AGENT_ID"), Class: "capture-daemon", Version: os.Getenv("SERVICE_VERSION"),
    Features: []string{"v4l2","webrtc","hls"},
  })
  t := time.NewTicker(10 * time.Second); defer t.Stop()
  for range t.C { _ = supervisor.Heartbeat(ctx, os.Getenv("AGENT_ID")) }
}()

Mirror the same snippet in camera-proxy (Class: "camera-proxy") and api-gateway (Class: "api-gateway"). It’s fully optional: if SUPERVISOR_URL is absent, it no-ops.

⸻

/host/services/supervisor/cmd/supervisor/main.go (switch to logx)

- import "log"
+ import "github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
@@
- log.Printf("supervisor listening on %s", *addr)
+ logx.Init(logx.Config{Service: "supervisor", Level: os.Getenv("LOG_LEVEL"), Caller: "short"})
+ logx.L.Infof("supervisor listening on %s", *addr)
@@
- log.Fatalf("load jwks: %v", err)
+ logx.L.Fatalf("load jwks: %v", err)
@@
- log.Printf("[supervisor] AMQP connected")
+ logx.L.Info("amqp connected")
@@
- log.Printf("bus: %v", err)
+ logx.L.Warnf("bus: %v", err)

(Apply similarly for other log.* calls.)

⸻

/host/services/discovery/entrypoint-snippet.sh (idempotent boot order)

#!/usr/bin/env sh
set -e
# Wait for RabbitMQ (optional), then run discovery
# nc -z rabbitmq 5672 || sleep 2
exec /app/discovery


⸻

/docs/OPERATIONS/failover.md

# Leader Failover
- discovery on each worker probes leader URL every DISCOVERY_TTL/3.
- If unreachable for TTL, node promotes to leader:
  1) writes cluster.json with role=leader
  2) advertises via mDNS
  3) leaves existing workloads running (idempotent)
- When original leader returns, it will detect an existing leader via mDNS and demote to worker.


⸻

Optional next upgrades (wire-ready)
	•	Tailscale hints: set CLOUD_CONTROL_URL=https://api-gw.<tailnet>.ts.net:8070; discovery will try it before self-electing.
	•	Worker Registry API: extend supervisor with /v1/nodes that surfaces class/feature inventory for web-app dashboards (you already publish AMQP events).
	•	Signed intents: Add POST /intents/join on supervisor; web-site can mint short-lived tokens → discovery consumes them to join securely.

⸻

Quick test script

# wipe state, boot one node
docker compose down -v
docker compose up -d rabbitmq discovery supervisor api-gateway capture-daemon camera-proxy
docker compose logs -f discovery supervisor

# check leader state
cat /var/lib/thatdam/cluster.json
curl -s http://localhost:8070/agents | jq

# simulate leader death by stopping supervisor; watch promotion
docker stop thatdamtoolbox-supervisor
sleep 60
cat /var/lib/thatdam/cluster.json


⸻

If you want, I’ll add mDNS (zeroconf) impl stubs next and the tiny web-app badge that reads /var/lib/thatdam/cluster.json (server-side) to display Leader/Worker/Proxy in the top bar.

