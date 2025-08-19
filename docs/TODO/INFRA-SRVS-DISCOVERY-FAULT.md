Short answer: you can opt-in/opt-out auto-discovery in entrypoints, but on two machines you must be careful about quorum, split-brain, and per-product cluster rules. The safest dev pattern is:
	•	Static topology by default, with discovery as a best-effort helper (never the source of truth for quorum’d systems).
	•	For 2 nodes, prefer single-node or RF=1 modes (where allowed), or accept zero fault tolerance for clustered modes.

Below is the practical breakdown + ready-to-drop code.

⸻

What works vs. what breaks on 2 nodes
	•	MinIO: Distributed MinIO requires ≥4 drives total (e.g., 2 nodes × 2 drives each is OK). Discovery is static: you must provide the full endpoint set at start. Ad-hoc discovery in the entrypoint won’t safely "grow" the set--MinIO expects a stable declared drive list.
	•	Weaviate: Uses Raft for schema/metadata. With 2 nodes, majority=2 ⇒ any node down halts writes. Discovery: Weaviate has gossip/raft ports but you still provide stable hostnames (seed). Dynamic self-discover in entrypoint can work (DNS/Consul), but treat it as seed resolution, not live cluster mutation.
	•	RabbitMQ: Quorum queues use Raft. With 2 nodes, majority=2 ⇒ no failure tolerance. Rabbit’s official peer discovery backends (K8s/Consul/ETCD) are reliable; DIY entrypoint discovery easily causes join/leave flapping. For dev: run single node or quorum RF=1 (development only), or add a witness (see below).
	•	Postgres: Native PG is single-primary. Patroni/Stolon require a DCS (etcd/Consul/K8s). With 2 nodes, you can run etcd=1 (no HA) or 2 (still no quorum). For dev: run single primary (+ optional async replica) and manual failover. Don’t depend on auto-discovery to choose leaders on 2 nodes.

Witness/arbiter idea: If you can add a tiny third node (Raspberry Pi, VM, or even a lightweight "witness" container hosting etcd/Consul only), you restore majority voting for Raft-based pieces (RabbitMQ quorum, Patroni DCS). It doesn’t serve traffic--just votes.

⸻

Sound "dev-safe" discovery design

Principle: Discovery should produce a stable, deterministic peer list before the daemon starts. Don’t let services constantly re-self-organize--especially with only 2 nodes.
	1.	Modes (explicit): DISCOVERY_MODE=static|dns|consul|noop
	2.	Static fallback: Always allow STATIC_PEERS=a:port,b:port,….
	3.	Bounded discovery window: Perform discovery once on start (with a short retry window), then freeze the result and boot the service.
	4.	Health-gated restarts: If the peer set changes later, bounce via supervisor/compose--not live hot merges on 2 nodes.
	5.	Per-service rules: Some components (MinIO) must use static endpoints; discovery only computes that list.

⸻

Drop-in entrypoint helper (Bash)

This helper gathers peers via static, DNS SRV, or Consul, freezes the list, and exports it for the service process.

/ops/entrypoints/discovery.sh

#!/usr/bin/env bash
set -euo pipefail

DISCOVERY_MODE="${DISCOVERY_MODE:-static}"
SERVICE_NAME="${SERVICE_NAME:-}"
SERVICE_PORT="${SERVICE_PORT:-}"
STATIC_PEERS="${STATIC_PEERS:-}"        # "host1:9000,host2:9000"
DNS_DOMAIN="${DNS_DOMAIN:-}"            # e.g. "minio.svc.cluster.local"
CONSUL_HTTP_ADDR="${CONSUL_HTTP_ADDR:-http://consul:8500}"
CONSUL_SVC="${CONSUL_SVC:-}"

FREEZE_FILE="${FREEZE_FILE:-/tmp/peers.frozen}"
MAX_WAIT="${MAX_WAIT:-15}"              # seconds to wait for discovery
SLEEP_STEP=3

if [[ -f "$FREEZE_FILE" ]]; then
  echo "[discovery] using frozen peers: $(cat "$FREEZE_FILE")"
  export DISCOVERED_PEERS="$(cat "$FREEZE_FILE")"
  exit 0
fi

gather_static() { echo "$STATIC_PEERS"; }

gather_dns() {
  # Requires busybox/nslookup or bind-utils; prefer SRV, fall back to A
  if command -v dig >/dev/null 2>&1; then
    if [[ -n "$SERVICE_NAME" && -n "$DNS_DOMAIN" && -n "$SERVICE_PORT" ]]; then
      # SRV: _svc._tcp.domain
      dig +short SRV "_${SERVICE_NAME}._tcp.${DNS_DOMAIN}" | awk '{print $4 ":" $3}' | sed 's/\.$//'
    elif [[ -n "$DNS_DOMAIN" && -n "$SERVICE_PORT" ]]; then
      dig +short "$DNS_DOMAIN" | awk -v p="$SERVICE_PORT" '{print $1":"p}'
    fi
  else
    # nslookup fallback
    if [[ -n "$DNS_DOMAIN" && -n "$SERVICE_PORT" ]]; then
      nslookup "$DNS_DOMAIN" | awk -v p="$SERVICE_PORT" '/Address: /{print $2":"p}'
    fi
  fi
}

gather_consul() {
  # Requires curl/jq
  [[ -z "$CONSUL_SVC" ]] && { echo >&2 "[discovery] CONSUL_SVC not set"; return; }
  curl -fsSL "${CONSUL_HTTP_ADDR}/v1/health/service/${CONSUL_SVC}?passing=true" \
    | jq -r '.[].Service | "\(.Address):\(.Port)"'
}

resolve_once() {
  case "$DISCOVERY_MODE" in
    static)  gather_static ;;
    dns)     gather_dns    ;;
    consul)  gather_consul ;;
    noop)    echo ""       ;;
    *)       echo >&2 "[discovery] unknown mode: $DISCOVERY_MODE"; exit 2 ;;
  esac
}

# bounded retry
deadline=$(( $(date +%s) + MAX_WAIT ))
peers=""
while [[ $(date +%s) -lt $deadline ]]; do
  peers="$(resolve_once | tr '\n' ',' | sed 's/,$//' || true)"
  if [[ -n "$peers" ]]; then break; fi
  sleep "$SLEEP_STEP"
done

if [[ -z "$peers" ]]; then
  echo "[discovery] no peers discovered; continuing with empty set"
else
  echo "$peers" > "$FREEZE_FILE"
fi

export DISCOVERED_PEERS="${peers}"
echo "[discovery] DISCOVERED_PEERS=${DISCOVERED_PEERS}"


⸻

Using the helper per service

MinIO (must be static at launch)
	•	For 2 machines, supply 4 endpoints total (e.g., 2 per host). Use discovery only to compute that list, then pass it directly to minio server.

/ops/entrypoints/minio.sh

#!/usr/bin/env bash
set -euo pipefail
/ops/entrypoints/discovery.sh

# DISCOVERED_PEERS could be "minio-a:9000,minio-b:9000,minio-c:9000,minio-d:9000"
IFS=',' read -r -a arr <<< "${DISCOVERED_PEERS:-}"
if [[ ${#arr[@]} -lt 4 ]]; then
  echo >&2 "[minio] need at least 4 endpoints (2 nodes × 2 drives)."
  exit 1
fi

# Transform to MinIO expected URL list (no paths!)
urls=()
for p in "${arr[@]}"; do
  host="${p%%:*}"
  urls+=("http://${host}/data")
done

exec minio server "${urls[@]}" --console-address :9001

Compose example (dev):

services:
  minio:
    image: minio/minio:latest
    entrypoint: ["/ops/entrypoints/minio.sh"]
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadminsecret
      DISCOVERY_MODE: static
      STATIC_PEERS: "minio-a:9000,minio-b:9000,minio-c:9000,minio-d:9000"
    volumes:
      - /mnt/a/data1:/data

In practice with plain Compose across two hosts, you’ll need a routable network (WireGuard/Tailscale + static DNS/Coredns) or move to Swarm/k8s for cross-host DNS.

⸻

Weaviate (seed discovery → frozen)
	•	Build a seed list once, pass hostnames/ports via env. With 2 nodes, accept no failure tolerance.

/ops/entrypoints/weaviate.sh

#!/usr/bin/env bash
set -euo pipefail
/ops/entrypoints/discovery.sh
SEEDS="${DISCOVERED_PEERS:-weaviate-0:7947,weaviate-1:7947}"
export CLUSTER_DATA_BIND_PORT="${CLUSTER_DATA_BIND_PORT:-7947}"
export CLUSTER_GOSSIP_BIND_PORT="${CLUSTER_GOSSIP_BIND_PORT:-7946}"
# Weaviate uses advertised hostnames; ensure container hostname resolves
exec /usr/bin/weaviate

Configure your compose to set predictable hostnames (or run on Swarm/k8s which gives you stable service DNS).

⸻

RabbitMQ (use supported discovery, or single-node)
	•	On 2 nodes, use single node or quorum RF=1 (dev only). If you insist on two-node clustering, use Consul peer discovery (official plugin) rather than ad-hoc DNS. Your entrypoint can still wait for the peer list and then start.

/ops/entrypoints/rabbit.sh

#!/usr/bin/env bash
set -euo pipefail
/ops/entrypoints/discovery.sh

export RABBITMQ_USE_LONGNAME=true
export RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS="-rabbit cluster_formation.peer_discovery_backend rabbit_peer_discovery_consul -rabbit cluster_formation.consul.host consul -rabbit cluster_formation.consul.svc rabbitmq"
# If DISCOVERED_PEERS set, we add as classic cluster nodes before enabling quorum policies (dev RF=1)
if [[ -n "${DISCOVERED_PEERS:-}" ]]; then
  IFS=',' read -r -a peers <<< "$DISCOVERED_PEERS"
  echo "[rabbit] peers: ${peers[*]}"
fi

exec docker-entrypoint.sh rabbitmq-server

Dev policy (RF=1) for quorum queues:

rabbitmqctl set_policy q-all '^q\.' '{"queue-master-locator":"client-local","quorum-queue":{"initial-group-size":1}}' --apply-to queues

This avoids the "required feature flag not enabled"/classic mirrored queue mess and is safe for dev.

⸻

Postgres (dev single primary)
	•	Keep it single primary on node A. If you want a warm standby on node B, use streaming replication and manual promotion. Discovery can be used by your app to find the primary via DNS SRV/Consul tag, but don’t attempt leader election with 2 nodes.

⸻

Common pitfalls with your idea (and how to avoid them)
	1.	Split-brain via flapping discovery
	•	Fix: Bounded discovery (freeze peers at boot). Let a higher layer (systemd/supervisor) trigger restarts on topology change.
	2.	Two-node Raft = zero tolerance
	•	Fix: Accept it for dev, or add a tiny witness. For RabbitMQ/Patroni, a 3rd voter (etcd/Consul) is huge.
	3.	MinIO dynamic membership
	•	Fix: Not supported. Always supply the full static endpoint set. Discovery can compute it, but not mutate it live.
	4.	Docker Compose multi-host DNS
	•	Fix: Compose alone won’t give cross-host service discovery. Use Swarm overlay, k3s, or WireGuard + Consul/CoreDNS.
	5.	Race conditions at first boot
	•	Fix: The helper retries briefly (MAX_WAIT) so peers can come up; otherwise falls back to static.

⸻

Minimal Go helper (library form)

If you prefer discovery inside your Go daemons, this wraps DNS SRV + Consul with an opt-in mode.

/internal/discovery/discovery.go

package discovery

import (
	"context"
	"fmt"
	"net"
	"os"
	"sort"
	"time"

	"github.com/hashicorp/consul/api"
)

type Mode string

const (
	Static Mode = "static"
	DNS    Mode = "dns"
	Consul Mode = "consul"
	Noop   Mode = "noop"
)

type Config struct {
	Mode         Mode
	StaticPeers  []string        // ["host:port", ...]
	DNSService   string          // "_svc._tcp.domain"
	DNSPort      int             // fallback port if A/AAAA lookups used
	ConsulAddr   string          // "http://consul:8500"
	ConsulName   string          // service name
	MaxWait      time.Duration   // discovery window
	PollInterval time.Duration   // retry step
}

func Discover(ctx context.Context, cfg Config) ([]string, error) {
	deadline := time.Now().Add(cfg.MaxWait)
	var peers []string
	for time.Now().Before(deadline) {
		ps, _ := resolveOnce(ctx, cfg)
		if len(ps) > 0 {
			peers = ps
			break
		}
		select {
		case <-time.After(cfg.PollInterval):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return peers, nil
}

func resolveOnce(ctx context.Context, cfg Config) ([]string, error) {
	switch cfg.Mode {
	case Static:
		return dedup(cfg.StaticPeers), nil
	case DNS:
		if cfg.DNSService != "" && cfg.DNSService[0] == '_' {
			// SRV
			_, addrs, err := net.LookupSRV("", "", cfg.DNSService)
			if err == nil {
				var out []string
				for _, a := range addrs {
					host := a.Target
					if host[len(host)-1] == '.' {
						host = host[:len(host)-1]
					}
					out = append(out, fmt.Sprintf("%s:%d", host, a.Port))
				}
				return dedup(out), nil
			}
		}
		// A/AAAA fallback using env DNS_DOMAIN
		domain := os.Getenv("DNS_DOMAIN")
		if domain != "" && cfg.DNSPort > 0 {
			ips, _ := net.LookupHost(domain)
			var out []string
			for _, ip := range ips {
				out = append(out, fmt.Sprintf("%s:%d", ip, cfg.DNSPort))
			}
			return dedup(out), nil
		}
	case Consul:
		c, err := api.NewClient(&api.Config{Address: cfg.ConsulAddr})
		if err != nil {
			return nil, err
		}
		hs, _, err := c.Health().Service(cfg.ConsulName, "", true, &api.QueryOptions{})
		if err != nil {
			return nil, err
		}
		var out []string
		for _, h := range hs {
			out = append(out, fmt.Sprintf("%s:%d", h.Service.Address, h.Service.Port))
		}
		return dedup(out), nil
	case Noop:
		return nil, nil
	}
	return nil, nil
}

func dedup(in []string) []string {
	m := map[string]struct{}{}
	for _, s := range in {
		if s == "" { continue }
		m[s] = struct{}{}
	}
	out := make([]string, 0, len(m))
	for k := range m { out = append(out, k) }
	sort.Strings(out)
	return out
}


⸻

Recommendation for your current stack (2 machines, dev)
	•	MinIO: 2× machines, 2 drives each → run distributed (static endpoints). No dynamic discovery after start.
	•	Weaviate: Run 2-node cluster for dev only (accept zero tolerance), or single node.
	•	RabbitMQ: Prefer single node with quorum RF=1 for dev; if you insist on 2 nodes, back peer discovery with Consul and keep the cluster stable.
	•	Postgres: Single primary; optional async replica; manual promotion.

If you can add a tiny third voter (witness), do it--your whole system behaves more like production with minimal hardware.

Want me to wire the entrypoints + compose into your repo in a /ops folder and adjust the service env for each container?