						# ThatDamToolbox - Integrated Build System (CLEAN MIGRATED)
# Only modern Go host services and Docker; fully migrated "capture-daemon" (no "-new", no legacy)

# =============================================================================
# CONFIGURATION
# =============================================================================

# Toggle build mode: override with `MODE=production` for production builds
MODE ?= development

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

ifeq ($(MODE),production)
  GO_BUILD_FLAGS += -trimpath
endif

SYSTEMD_DIR       := /etc/systemd/system
BIN_DIR           := /usr/local/bin
DATA_DIR          := /var/lib/thatdamtoolbox
MEDIA_DIR         := /var/media/records

DOCKER_IMAGE ?= thatdamtoolbox

# Include infra targets (infra.mk)
include scripts/make/infra.mk

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
# IMAGE BUILD/PUSH (Buildx + SBOM/Provenance)
# =============================================================================

PROJECT ?= thatdamtoolbox
REGISTRY ?= ghcr.io/cdaprod
TAG ?= $(shell git rev-parse --short=12 HEAD)
DATE ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)

IMAGES = video video-web web-site api-gateway overlay-hub supervisor capture-daemon camera-proxy media-api runner

define build_one
@docker buildx build \
--file docker/$(1)/Dockerfile \
--provenance=true \
--sbom=true \
--label org.opencontainers.image.created=$(DATE) \
--label org.opencontainers.image.revision=$(TAG) \
--build-arg BUILDKIT_INLINE_CACHE=1 \
--cache-from type=local,src=/tmp/buildx-cache \
--cache-to type=local,dest=/tmp/buildx-cache,mode=max \
--tag $(REGISTRY)/$(1):$(TAG) \
--tag $(REGISTRY)/$(1):latest \
.
endef

.PHONY: build-images push-images login-ghcr
build-images: ## build all images locally with cache
	$(foreach img,$(IMAGES),$(call build_one,$(img)))

push-images: ## build and push all images to GHCR
	@for img in $(IMAGES); do \
  docker buildx build \
    --file docker/$$img/Dockerfile \
    --provenance=true --sbom=true \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --cache-from type=registry,ref=$(REGISTRY)/thatdamtoolbox-cache:build \
    --cache-to type=registry,ref=$(REGISTRY)/thatdamtoolbox-cache:build,mode=max \
    --tag $(REGISTRY)/$$img:$(TAG) \
    --tag $(REGISTRY)/$$img:latest \
    --push . ; \
done

login-ghcr: ## login to GHCR (requires GHCR_USER and GHCR_TOKEN)
	@echo "$$GHCR_TOKEN" | docker login ghcr.io -u $$GHCR_USER --password-stdin

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

# Host services and build settings
HOST_SERVICES := api-gateway camera-proxy capture-daemon
HOST_SERVICE_DIR_api-gateway := $(HOST_SERVICES_DIR)/api-gateway
HOST_SERVICE_DIR_camera-proxy := $(HOST_SERVICES_DIR)/camera-proxy
HOST_SERVICE_DIR_capture-daemon := $(HOST_SERVICES_DIR)/capture-daemon
HOST_SERVICE_PKG_api-gateway := ./cmd
HOST_SERVICE_PKG_camera-proxy := .
HOST_SERVICE_PKG_capture-daemon := .
HOST_SERVICE_DIRS := $(HOST_SERVICE_DIR_api-gateway) $(HOST_SERVICE_DIR_camera-proxy) $(HOST_SERVICE_DIR_capture-daemon)

# Any other workspace modules get a generic build ./...
OTHER_MODULES := $(filter-out \
  $(HOST_SERVICE_DIRS), \
  $(WORK_MODULES))

.PHONY: build-all $(addprefix build-,$(HOST_SERVICES)) install-all \
	setup-system install-binaries install-services enable-services \
	go-list go-tidy go-build-rest

# Build all Go services:
# 1) Build named binaries for the core host services
# 2) Build remaining workspace modules generically (cache warm / ensure compile)
build-all: $(addprefix build-,$(HOST_SERVICES)) go-build-rest

build-%: ## Build host service %
	@svc_dir=$(HOST_SERVICE_DIR_$*); \
	echo "🔨 $$svc_dir"; \
	cd "$$svc_dir" && \
	CGO_ENABLED="$(CGO_ENABLED)" "$(GO_BIN)" build $(GO_BUILD_FLAGS) -o $* $(HOST_SERVICE_PKG_$*)

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
	$(foreach svc,$(HOST_SERVICES),sudo install -m755 $(HOST_SERVICE_DIR_$(svc))/$(svc) $(BIN_DIR)/; )

install-services: ## Install systemd services
	@echo "Installing systemd services..."
	$(foreach svc,$(HOST_SERVICES),sudo install -m644 scripts/systemd/$(svc).service $(SYSTEMD_DIR)/; )
	sudo systemctl daemon-reload

enable-services: ## Enable all services
	@echo "Enabling services..."
	-sudo systemctl enable $(HOST_SERVICES)


# =============================================================================
# SERVICE MANAGEMENT
# =============================================================================

SERVICES := $(HOST_SERVICES)

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
	./scripts/health.sh

test: ## Run tests
	./scripts/test.sh

dev-test: ## Quick development test
	@echo "Testing service connectivity..."
	@curl -s http://localhost:8000/api/devices || echo "Camera proxy: OFFLINE"
	@curl -s http://localhost:8080/api/health || echo "API gateway: OFFLINE"
	@curl -s http://localhost:8080/health || echo "Python API: OFFLINE"
	@curl -s http://localhost:3000/ || echo "Frontend: OFFLINE"


# =============================================================================
# DEVELOPMENT MODE
# =============================================================================

DEV_CMDS_api-gateway := cd $(HOST_SERVICE_DIR_api-gateway) && ./api-gateway -addr=:8080 -backend-url=http://localhost:8000 -media-dir=./data/media -db-path=./data/db/live.sqlite3
DEV_CMDS_camera-proxy := cd $(HOST_SERVICE_DIR_camera-proxy) && PROXY_PORT=8000 BACKEND_URL=http://localhost:8080 ./camera-proxy
DEV_CMDS_capture-daemon := cd $(HOST_SERVICE_DIR_capture-daemon) && ./capture-daemon /dev/video0

.PHONY: $(addprefix dev-,$(HOST_SERVICES)) dev-docker dev-all

dev-%: build-% ## Run % in development mode
	$(DEV_CMDS_$*)

dev-docker: ## Run Docker services in development mode
	$(DOCKER_COMPOSE) up

dev-all: ## Start everything in development mode
	@echo "Starting development environment..."
	$(MAKE) dev-docker &
	sleep 5
	$(foreach svc,$(HOST_SERVICES),$(MAKE) dev-$(svc) & sleep 2; )
	wait
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
