# ThatDamToolbox - Integrated Build System (CLEAN MIGRATED)
# Only modern Go host services and Docker; fully migrated "capture-daemon" (no "-new", no legacy)

# =============================================================================
# CONFIGURATION
# =============================================================================

HOST_SERVICES_DIR := host/services

# ───────── Dynamic Compose layer discovery ─────────
BASE_COMPOSE      := docker/compose/docker-compose.base.yaml
ALL_ROLE_FILES    := $(shell find docker/compose -maxdepth 1 -name 'docker-compose.*.y*ml' ! -name '*base*' | sort)

# Role selector: make compose-up ROLE=backend
ROLE ?=
ifeq ($(ROLE),)
  COMPOSE_FILES   := $(BASE_COMPOSE) $(ALL_ROLE_FILES)
else
  COMPOSE_FILES   := $(BASE_COMPOSE) $(shell find docker/compose -name 'docker-compose.$(ROLE).y*ml')
endif

DOCKER_COMPOSE    = docker compose $(foreach f,$(COMPOSE_FILES),-f $(f))
GO_BUILD_FLAGS    := -ldflags="-w -s" -a -installsuffix cgo
CGO_ENABLED       := 0

SYSTEMD_DIR       := /etc/systemd/system
BIN_DIR           := /usr/local/bin
DATA_DIR          := /var/lib/thatdamtoolbox
MEDIA_DIR         := /var/media/records

DOCKER_IMAGE ?= thatdamtoolbox

# =============================================================================
# MAIN TARGETS
# =============================================================================

.PHONY: all help clean

all: build-all install-all docker-build ## Build everything (Docker + Go services)

help: ## Show this help
	@echo "ThatDamToolbox Build System"
	@echo "=========================="
	@echo
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# =============================================================================
# VERSIONING (GitVersion SemVer parity: local == CI)
# =============================================================================

# Cache file lives under .github, not .git
REPO_ROOT       := $(shell git rev-parse --show-toplevel)
GITVERSION_YML  := $(REPO_ROOT)/.github/GitVersion.yml
GITVERSION_CACHE:= $(REPO_ROOT)/.github/.gitversion

define run_gitversion
	@if command -v gitversion >/dev/null 2>&1; then \
	    gitversion /config "$(GITVERSION_YML)" -verbosity Warn; \
	else \
	    docker run --rm -v "$(REPO_ROOT)":/repo gittools/gitversion:5 /repo \
	        /config /repo/.github/GitVersion.yml -verbosity Warn; \
	fi
endef

.PHONY: version
version:
	@echo "🔍 Computing version with GitVersion..."
	@mkdir -p "$(dir $(GITVERSION_CACHE))"
	$(call run_gitversion) | tee "$(GITVERSION_CACHE)" >/dev/null

# If cache missing, populate it once during parse
ifeq ($(wildcard $(GITVERSION_CACHE)),)
  $(shell $(MAKE) --no-print-directory version >/dev/null)
endif

VERSION   := $(shell awk '/^SemVer:/ {print $$2}' "$(GITVERSION_CACHE)")
SHORT_SHA := $(shell git rev-parse --short HEAD)

# =============================================================================
# DOCKER TARGETS
# =============================================================================

.PHONY: docker-build docker-up docker-down docker-logs docker-restart docker-status \
        compose-up compose-down compose-logs compose-restart compose-status

docker-build: ## Build Docker images (conditionally tag with TAG_IMAGE=true)
	@echo "📦 Building $(DOCKER_IMAGE):latest with VERSION=$(VERSION) and SHA=$(SHORT_SHA)"
	$(DOCKER_COMPOSE) build \
		--build-arg VERSION="$(VERSION)" \
		--build-arg GIT_SHA="$(SHORT_SHA)"
	@if [ -n "$(strip $(TAG_IMAGE))" ]; then \
	  echo "🏷️  Tagging image as $(DOCKER_IMAGE):$(VERSION)"; \
	  docker tag "$(DOCKER_IMAGE):latest" "$(DOCKER_IMAGE):$(VERSION)"; \
	fi

docker-up: ## Start Docker services
	$(DOCKER_COMPOSE) up -d

docker-down: ## Stop Docker services
	$(DOCKER_COMPOSE) down

docker-logs: ## Follow Docker logs
	$(DOCKER_COMPOSE) logs -f

docker-restart: docker-down docker-up ## Restart Docker services

docker-status: ## Show Docker service status
	$(DOCKER_COMPOSE) ps

compose-up: docker-up
compose-down: docker-down
compose-logs: docker-logs
compose-restart: docker-restart
compose-status: docker-status

# =============================================================================
# GO HOST SERVICES (workspace-driven, keeps named binaries for 3 core services)
# =============================================================================

# --- Go workspace discovery (robust, ASCII-only) -----------------------------
GO_BIN    ?= go
WORK_JSON := $(shell $(GO_BIN) work edit -json 2>/dev/null || true)

ifeq ($(strip $(WORK_JSON)),)
  # Fallback: parse `use` lines from go.work (handles block and single-line)
  WORK_MODULES := $(shell awk 'BEGIN{inuse=0} \
    /^use[[:space:]]*\(/ {inuse=1; next} \
    /^\)/               {inuse=0} \
    inuse==1 && $$1 ~ /^\.\// {print $$1} \
    /^use[[:space:]]+\.\// {sub(/^use[[:space:]]+/,""); print} \
  ' go.work 2>/dev/null || true)
else
  # Extract all DiskPath entries from JSON without jq
  WORK_MODULES := $(shell printf '%s\n' '$(WORK_JSON)' \
    | grep -o '"DiskPath":"[^"]*"' \
    | sed 's/.*"DiskPath":"//;s/"$$//') \
endif

# Normalize list (drop empties, sort/dedupe)
WORK_MODULES := $(sort $(strip $(WORK_MODULES)))

# Core services that produce named binaries (install step depends on these paths)
CORE_GATEWAY_DIR         := $(HOST_SERVICES_DIR)/api-gateway
CORE_PROXY_DIR           := $(HOST_SERVICES_DIR)/camera-proxy
CORE_CAPTURE_DAEMON_DIR  := $(HOST_SERVICES_DIR)/capture-daemon

# Any other workspace modules get a generic build ./...
OTHER_MODULES := $(filter-out \
  $(CORE_GATEWAY_DIR) \
  $(CORE_PROXY_DIR) \
  $(CORE_CAPTURE_DAEMON_DIR), \
  $(WORK_MODULES))

.PHONY: build-all build-gateway build-proxy build-capture-daemon install-all \
        setup-system install-binaries install-services enable-services \
        go-list go-tidy go-build-rest

# Build all Go services:
# 1) Build named binaries for the three core services (as before)
# 2) Build remaining workspace modules generically (cache warm / ensure compile)
build-all: build-gateway build-proxy build-capture-daemon go-build-rest

build-gateway: ## Build API Gateway
	@echo "🔨 $(CORE_GATEWAY_DIR)"
	cd "$(CORE_GATEWAY_DIR)" && \
	CGO_ENABLED="$(CGO_ENABLED)" "$(GO_BIN)" build $(GO_BUILD_FLAGS) -o api-gateway ./cmd

build-proxy: ## Build Camera Proxy
	@echo "🔨 $(CORE_PROXY_DIR)"
	cd "$(CORE_PROXY_DIR)" && \
	CGO_ENABLED="$(CGO_ENABLED)" "$(GO_BIN)" build $(GO_BUILD_FLAGS) -o camera-proxy .

build-capture-daemon: ## Build the capture daemon
	@echo "🔨 $(CORE_CAPTURE_DAEMON_DIR)"
	cd "$(CORE_CAPTURE_DAEMON_DIR)" && \
	CGO_ENABLED="$(CGO_ENABLED)" "$(GO_BIN)" build $(GO_BUILD_FLAGS) -o capture-daemon .

go-build-rest: ## Build remaining workspace modules (generic ./...)
	@mods="$(OTHER_MODULES)"; \
	if [ -n "$$mods" ]; then \
	  set -e; \
	  for m in $$mods; do \
	    echo "🔧 build $$m"; \
	    "$(GO_BIN)" -C "$$m" build ./...; \
	  done; \
	else \
	  echo "ℹ️  No additional workspace modules to build"; \
	fi

# Workspace helpers
go-list: ## List modules from go.work
	@mods="$(WORK_MODULES)"; \
	if [ -n "$$mods" ]; then \
	  printf 'Workspace modules:\n'; \
	  for m in $$mods; do printf '  • %s\n' "$$m"; done; \
	else \
	  echo "ℹ️  No modules found in go.work"; \
	fi

go-tidy: ## go mod tidy for all modules in go.work
	@mods="$(WORK_MODULES)"; \
	if [ -n "$$mods" ]; then \
	  set -e; \
	  for m in $$mods; do \
	    echo "→ tidy $$m"; \
	    "$(GO_BIN)" -C "$$m" mod tidy; \
	  done; \
	else \
	  echo "ℹ️  No modules to tidy"; \
	fi

# Install all services
install-all: build-all setup-system install-binaries install-services enable-services ## Install everything

setup-system: ## Create users and directories
	@echo "Setting up system users and directories..."
	-sudo useradd -r -s /bin/false -G video camera-proxy 2>/dev/null || true
	-sudo useradd -r -s /bin/false -G video capture-user 2>/dev/null || true
	sudo mkdir -p $(DATA_DIR)/db $(MEDIA_DIR) /opt/thatdamtoolbox/web
	sudo chown -R www-data:www-data $(DATA_DIR)
	sudo chown -R video:video $(MEDIA_DIR)
	sudo chmod 755 $(DATA_DIR) $(MEDIA_DIR)

install-binaries: ## Install all binaries
	@echo "Installing binaries..."
	sudo install -m755 $(CORE_GATEWAY_DIR)/api-gateway $(BIN_DIR)/
	sudo install -m755 $(CORE_PROXY_DIR)/camera-proxy $(BIN_DIR)/
	sudo install -m755 $(CORE_CAPTURE_DAEMON_DIR)/capture-daemon $(BIN_DIR)/

install-services: ## Install systemd services
	@echo "Installing systemd services..."
	sudo install -m644 scripts/systemd/*.service $(SYSTEMD_DIR)/ 2>/dev/null || true
	sudo systemctl daemon-reload

enable-services: ## Enable all services
	@echo "Enabling services..."
	-sudo systemctl enable api-gateway camera-proxy capture-daemon


# =============================================================================
# SERVICE MANAGEMENT
# =============================================================================

SERVICES := api-gateway camera-proxy capture-daemon

.PHONY: start stop restart status logs start-% stop-% restart-% status-% logs-%

start: ## Start all services
	@echo "▶️  Starting: $(SERVICES)"
	sudo systemctl start $(SERVICES)

stop: ## Stop all services
	@echo "⏹  Stopping: $(SERVICES)"
	sudo systemctl stop $(SERVICES)

restart: ## Restart all services
	@echo "🔁 Restarting: $(SERVICES)"
	sudo systemctl restart $(SERVICES)

status: ## Show service status (host + docker)
	@echo "=== Host Services Status ==="
	-@for s in $(SERVICES); do sudo systemctl status $$s --no-pager -l || true; done
	@echo
	@echo "=== Docker Services Status ==="
	$(DOCKER_COMPOSE) ps

logs: ## Tail host services logs
	@echo "=== Host Services Logs (follow) ==="
	sudo journalctl -fu $(SERVICES) --no-pager

# ---------------- Individual service helpers ----------------

start-%: ## Start a single service (make start-<name>)
	@echo "▶️  Starting: $*"
	sudo systemctl start $*

stop-%: ## Stop a single service (make stop-<name>)
	@echo "⏹  Stopping: $*"
	sudo systemctl stop $*

restart-%: ## Restart a single service (make restart-<name>)
	@echo "🔁 Restarting: $*"
	sudo systemctl restart $*

status-%: ## Status for a single service (make status-<name>)
	-@sudo systemctl status $* --no-pager -l || true

logs-%: ## Follow logs for a single service (make logs-<name>)
	@echo "=== Logs for $* (follow) ==="
	sudo journalctl -fu $* --no-pager


# =============================================================================
# HEALTH & TESTING
# =============================================================================

.PHONY: health test dev-test

health: ## Check system health
	@echo "=== System Health Check ==="
	@echo "Camera Proxy:"
	@curl -s http://localhost:8000/api/devices | jq '.' 2>/dev/null || echo "  ❌ Camera proxy not responding"
	@echo -e "\nAPI Gateway:"
	@curl -s http://localhost:8080/api/health | jq '.' 2>/dev/null || echo "  ❌ API gateway not responding"
	@echo -e "\nDocker Services:"
	@curl -s http://localhost:8080/health 2>/dev/null && echo "  ✅ Python API healthy" || echo "  ❌ Python API not responding"
	@curl -s http://localhost:3000/api/health 2>/dev/null && echo "  ✅ Next.js frontend healthy" || echo "  ❌ Next.js frontend not responding"
	@echo -e "\nStorage:"
	@df -h $(MEDIA_DIR) 2>/dev/null || echo "  ❌ Media directory not accessible"
	@echo -e "\nMemory:"
	@free -h

test: ## Run tests
	@echo "Running Go tests..."
	cd $(HOST_SERVICES_DIR)/shared && go test ./... || true
	cd $(HOST_SERVICES_DIR)/api-gateway && go test ./... || true
	@echo "Running Python tests..."
	python -m pytest tests/ -v || true

dev-test: ## Quick development test
	@echo "Testing service connectivity..."
	@curl -s http://localhost:8000/api/devices || echo "Camera proxy: OFFLINE"
	@curl -s http://localhost:8080/api/health || echo "API gateway: OFFLINE"
	@curl -s http://localhost:8080/health || echo "Python API: OFFLINE"
	@curl -s http://localhost:3000/ || echo "Frontend: OFFLINE"


# =============================================================================
# DEVELOPMENT MODE
# =============================================================================

.PHONY: dev-gateway dev-proxy dev-capture dev-docker dev-all

dev-gateway: build-gateway ## Run gateway in development mode
	cd $(HOST_SERVICES_DIR)/api-gateway && \
	./api-gateway -addr=:8080 -backend-url=http://localhost:8000 -media-dir=./data/media -db-path=./data/db/live.sqlite3

dev-proxy: build-proxy ## Run proxy in development mode
	cd $(HOST_SERVICES_DIR)/camera-proxy && \
	PROXY_PORT=8000 BACKEND_URL=http://localhost:8080 ./camera-proxy

dev-capture: build-capture-daemon ## Run capture daemon in development mode
	cd $(HOST_SERVICES_DIR)/capture-daemon && \
	./capture-daemon /dev/video0

dev-docker: ## Run Docker services in development mode
        $(DOCKER_COMPOSE) up

dev-all: ## Start everything in development mode
	@echo "Starting development environment..."
	$(MAKE) dev-docker &
	sleep 5
	$(MAKE) dev-proxy &
	sleep 2
	$(MAKE) dev-gateway &
	@echo "All services starting... Use Ctrl+C to stop"


# =============================================================================
# DEPLOYMENT MODES
# =============================================================================

.PHONY: deploy-integrated deploy-docker-only deploy-host-only

deploy-integrated: ## Full deployment (Docker + Host services)
	@echo "=== Full Integrated Deployment ==="
	$(MAKE) docker-down
	$(MAKE) install-all
	$(MAKE) start
	sleep 5
	$(MAKE) docker-up
	$(MAKE) health

deploy-docker-only: ## Docker-only deployment (existing mode)
	@echo "=== Docker-Only Deployment ==="
	$(MAKE) docker-down
	$(MAKE) stop 2>/dev/null || true
	$(MAKE) docker-up
	$(MAKE) health

deploy-host-only: ## Host services only (no Docker)
	@echo "=== Host Services Only ==="
	$(MAKE) docker-down
	$(MAKE) install-all
	$(MAKE) start
	$(MAKE) health


# =============================================================================
# MAINTENANCE & CLEANUP
# =============================================================================

.PHONY: clean-all clean-go clean-docker uninstall-all clean-work clean-bins

clean-all: clean-go clean-docker ## Clean everything

# Remove built binaries for core services (safe if missing)
clean-go: ## Clean Go build artifacts
	@echo "🧹 Cleaning Go artifacts"
	@rm -f "$(HOST_SERVICES_DIR)/api-gateway/api-gateway"
	@rm -f "$(HOST_SERVICES_DIR)/camera-proxy/camera-proxy"
	@rm -f "$(HOST_SERVICES_DIR)/capture-daemon/capture-daemon"

# Optional: nuke local Go build cache & module cache (use when CI space is tight)
clean-work: ## Clean Go build caches (~/.cache/go-build and GOPATH mod cache)
	@echo "🗑  Clearing Go build cache"
	@go clean -cache -testcache -modcache

# Remove compose stack, images built by this repo, volumes, orphans
clean-docker: ## Clean Docker resources
	$(DOCKER_COMPOSE) down --rmi all --volumes --remove-orphans 2>/dev/null || true
	docker system prune -f

# Remove installed binaries from /usr/local/bin (leave data dirs intact)
clean-bins: ## Remove installed binaries only (keeps services + data)
	@echo "🧽 Removing installed binaries from $(BIN_DIR)"
	-@sudo rm -f "$(BIN_DIR)/api-gateway" "$(BIN_DIR)/camera-proxy" "$(BIN_DIR)/capture-daemon"

uninstall-all: ## Uninstall everything
	@echo "🧨 Uninstalling all services..."
	-@sudo systemctl stop api-gateway camera-proxy capture-daemon
	-@sudo systemctl disable api-gateway camera-proxy capture-daemon
	-@sudo rm -f "$(BIN_DIR)/api-gateway" "$(BIN_DIR)/camera-proxy" "$(BIN_DIR)/capture-daemon"
	-@sudo rm -f "$(SYSTEMD_DIR)/api-gateway.service" "$(SYSTEMD_DIR)/camera-proxy.service" "$(SYSTEMD_DIR)/capture-daemon.service"
	@sudo systemctl daemon-reload
	@echo "✅ Uninstall complete. Data directories preserved."


# =============================================================================
# VERSION TAGGING
# =============================================================================
.PHONY: tag

tag: ## Manually tag the current commit with the computed version
	@git tag -a "$(VERSION)" -m "Release $(VERSION)"
	@git push origin "$(VERSION)"


# =============================================================================
# GITHUB ACTIONS BUILD REPORT ARTIFACT
# =============================================================================
.PHONY: download-report

download-report: ## Download GitHub Actions build-report artifact
	@gh run download --repo $$GITHUB_REPOSITORY --pattern build-report.txt --name build-report
	@echo "✅ build-report.txt saved"
	@ls -l build-report.txt


# =============================================================================
# INFRA LAYER BOOTSTRAPPING
# =============================================================================

# ---- Config ----
INFRA_COMPOSE        ?= docker/compose/infra.yaml
INFRA_PROFILE        ?= infra
INFRA_DOCKER_COMPOSE := docker compose -f "$(INFRA_COMPOSE)" --profile "$(INFRA_PROFILE)"

.PHONY: infra-build infra-up infra-wait infra-bootstrap-weaviate infra-up-all infra-down infra-logs

# ---- Build All Infra Layer Services ----
infra-build:
	$(INFRA_DOCKER_COMPOSE) build --pull

# ---- Deploy Infra Layer (up in detached mode) ----
infra-up:
	$(INFRA_DOCKER_COMPOSE) up -d --wait --pull always --remove-orphans

# ---- Wait for All Services to be Healthy ----
# Falls back to "running" if a service has no healthcheck.
infra-wait:
	@echo "⏳ Waiting for infra services to be healthy (profile=$(INFRA_PROFILE))..."
	@$(INFRA_DOCKER_COMPOSE) ps
	@set -e; \
	DEADLINE=$$(($(date +%s) + 90)); \
	while :; do \
	  all_ok=1; \
	  for cid in $$($(INFRA_DOCKER_COMPOSE) ps -q); do \
	    st=$$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $$cid 2>/dev/null || echo "unknown"); \
	    case "$$st" in \
	      healthy|running) : ;; \
	      *) all_ok=0 ;; \
	    esac; \
	  done; \
	  [ "$$all_ok" -eq 1 ] && break; \
	  [ $$(date +%s) -ge $$DEADLINE ] && echo "❌ Timeout waiting for infra health" && exit 1; \
	  sleep 3; \
	  $(INFRA_DOCKER_COMPOSE) ps; \
	done
	@echo "✅ All infra services healthy!"

# ---- Bootstrap Weaviate (Schema, etc) ----
infra-bootstrap-weaviate:
	@echo "🚀 Bootstrapping Weaviate schema..."
	$(INFRA_DOCKER_COMPOSE) run --rm weaviate-schema-bootstrap

# ---- One-Stop Infra Layer Bringup (build, up, wait, bootstrap) ----
infra-up-all: infra-build infra-up infra-wait infra-bootstrap-weaviate
	@echo "🚦 Infra layer fully deployed and bootstrapped."

# ---- Teardown/Cleanup ----
infra-down:
	$(INFRA_DOCKER_COMPOSE) down --remove-orphans --volumes

# ---- Logs ----
infra-logs:
	$(INFRA_DOCKER_COMPOSE) logs -f


# =============================================================================
# QUICK REFERENCE
# =============================================================================

info: ## Show configuration info
	@echo "ThatDamToolbox Configuration"
	@echo "==========================="
	@echo "Architecture: $(shell uname -m)"
	@echo "Docker Compose: docker-compose.yaml"
	@echo "Go Workspace: go.work"
	@echo ""
	@echo "Services:"
	@echo "  Docker Python API: :8080 (host mode)"
	@echo "  Docker Next.js:     :3000"
	@echo "  Host API Gateway:   :8080 (when enabled)"
	@echo "  Host Camera Proxy:  :8000 (when enabled)"
	@echo ""
	@echo "Data Locations:"
	@echo "  Media: $(MEDIA_DIR)"
	@echo "  Database: $(DATA_DIR)/db"
	@echo "  Logs: journalctl -u <service>"