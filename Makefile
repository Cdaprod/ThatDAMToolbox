# ThatDamToolbox - Integrated Build System
# Supports: Docker services + Go host services + Legacy capture daemon

# =============================================================================
# CONFIGURATION
# =============================================================================

# Legacy capture daemon (keep existing)
GO_SRC      := cmd/capture-daemon
BIN_NAME    := capture-daemon
BIN_PATH    := /usr/local/bin/$(BIN_NAME)
SERVICE_SRC := scripts/rules/camera-record.service
SERVICE_DST := /etc/systemd/system/camera-record.service

# New host services
HOST_SERVICES_DIR := host/services
GO_BUILD_FLAGS    := -ldflags="-w -s" -a -installsuffix cgo
CGO_ENABLED       := 0

# Directories
SYSTEMD_DIR       := /etc/systemd/system
BIN_DIR          := /usr/local/bin
DATA_DIR         := /var/lib/thatdamtoolbox
MEDIA_DIR        := /var/media/records

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
# DOCKER TARGETS
# =============================================================================

.PHONY: docker-build docker-up docker-down docker-logs docker-restart

docker-build: ## Build Docker images
	docker compose build

docker-up: ## Start Docker services
	docker compose up -d

docker-down: ## Stop Docker services
	docker compose down

docker-logs: ## Follow Docker logs
	docker compose logs -f

docker-restart: docker-down docker-up ## Restart Docker services

docker-status: ## Show Docker service status
	docker compose ps

# =============================================================================
# GO HOST SERVICES
# =============================================================================

.PHONY: build-all build-gateway build-proxy build-capture-new install-all

# Build all Go services
build-all: build-gateway build-proxy build-capture-new build-legacy

# Individual service builds
build-gateway: ## Build API Gateway
	cd $(HOST_SERVICES_DIR)/api-gateway && \
	CGO_ENABLED=$(CGO_ENABLED) go build $(GO_BUILD_FLAGS) -o api-gateway ./cmd

build-proxy: ## Build Camera Proxy
	cd $(HOST_SERVICES_DIR)/camera-proxy && \
	CGO_ENABLED=$(CGO_ENABLED) go build $(GO_BUILD_FLAGS) -o camera-proxy .

build-capture-new: ## Build new capture daemon (host services)
	cd $(HOST_SERVICES_DIR)/capture-daemon && \
	CGO_ENABLED=$(CGO_ENABLED) go build $(GO_BUILD_FLAGS) -o capture-daemon-new .

build-legacy: ## Build legacy capture daemon (keep existing)
	cd $(GO_SRC) && go build -o ../../$(BIN_NAME) .

# Install all services
install-all: build-all setup-system install-binaries install-services enable-services ## Install everything

setup-system: ## Create users and directories
	@echo "Setting up system users and directories..."
	# Create service users
	-sudo useradd -r -s /bin/false -G video camera-proxy 2>/dev/null || true
	-sudo useradd -r -s /bin/false -G video capture-user 2>/dev/null || true
	
	# Create directories
	sudo mkdir -p $(DATA_DIR)/db $(MEDIA_DIR) /opt/thatdamtoolbox/web
	sudo chown -R www-data:www-data $(DATA_DIR)
	sudo chown -R video:video $(MEDIA_DIR)
	sudo chmod 755 $(DATA_DIR) $(MEDIA_DIR)

install-binaries: ## Install all binaries
	@echo "Installing binaries..."
	# New host services
	sudo install -m755 $(HOST_SERVICES_DIR)/api-gateway/api-gateway $(BIN_DIR)/
	sudo install -m755 $(HOST_SERVICES_DIR)/camera-proxy/camera-proxy $(BIN_DIR)/
	sudo install -m755 $(HOST_SERVICES_DIR)/capture-daemon/capture-daemon-new $(BIN_DIR)/
	# Legacy capture daemon
	sudo install -m755 $(BIN_NAME) $(BIN_PATH)

install-services: ## Install systemd services
	@echo "Installing systemd services..."
	# New services
	sudo install -m644 scripts/systemd/*.service $(SYSTEMD_DIR)/ 2>/dev/null || true
	# Legacy service  
	sudo install -m644 $(SERVICE_SRC) $(SERVICE_DST)
	sudo systemctl daemon-reload

enable-services: ## Enable all services
	@echo "Enabling services..."
	# Choose your capture strategy:
	# Option 1: Use new capture daemon
	-sudo systemctl enable api-gateway camera-proxy capture-daemon
	# Option 2: Use legacy capture daemon
	# -sudo systemctl enable api-gateway camera-proxy camera-record
	
	# Don't enable both capture services simultaneously

# =============================================================================
# SERVICE MANAGEMENT
# =============================================================================

.PHONY: start stop restart status logs

start: ## Start all services
	sudo systemctl start api-gateway camera-proxy capture-daemon
	# sudo systemctl start camera-record  # Use this for legacy instead

stop: ## Stop all services
	sudo systemctl stop api-gateway camera-proxy capture-daemon camera-record

restart: stop start ## Restart all services

status: ## Show service status
	@echo "=== Host Services Status ==="
	-sudo systemctl status api-gateway --no-pager -l
	-sudo systemctl status camera-proxy --no-pager -l  
	-sudo systemctl status capture-daemon --no-pager -l
	-sudo systemctl status camera-record --no-pager -l
	@echo -e "\n=== Docker Services Status ==="
	docker compose ps

logs: ## Show all logs
	@echo "=== Host Services Logs ==="
	sudo journalctl -u api-gateway -u camera-proxy -u capture-daemon -u camera-record -f --no-pager

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

.PHONY: dev-gateway dev-proxy dev-capture dev-docker

dev-gateway: build-gateway ## Run gateway in development mode
	cd $(HOST_SERVICES_DIR)/api-gateway && \
	./api-gateway -addr=:8080 -backend-url=http://localhost:8000 -media-dir=./data/media -db-path=./data/db/live.sqlite3

dev-proxy: build-proxy ## Run proxy in development mode
	cd $(HOST_SERVICES_DIR)/camera-proxy && \
	PROXY_PORT=8000 BACKEND_URL=http://localhost:8080 ./camera-proxy

dev-capture: build-capture-new ## Run new capture daemon in development mode
	cd $(HOST_SERVICES_DIR)/capture-daemon && \
	./capture-daemon-new /dev/video0

dev-docker: ## Run Docker services in development mode
	docker compose -f docker-compose.yaml up

# Combined development: run everything
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

.PHONY: clean-all clean-go clean-docker uninstall-all

clean-all: clean-go clean-docker ## Clean everything

clean-go: ## Clean Go build artifacts
	rm -f $(BIN_NAME)
	rm -f $(HOST_SERVICES_DIR)/api-gateway/api-gateway
	rm -f $(HOST_SERVICES_DIR)/camera-proxy/camera-proxy  
	rm -f $(HOST_SERVICES_DIR)/capture-daemon/capture-daemon-new

clean-docker: ## Clean Docker resources
	docker compose down --rmi all --volumes --remove-orphans 2>/dev/null || true
	docker system prune -f

uninstall-all: ## Uninstall everything
	@echo "Uninstalling all services..."
	# Stop services
	-sudo systemctl stop api-gateway camera-proxy capture-daemon camera-record
	-sudo systemctl disable api-gateway camera-proxy capture-daemon camera-record
	
	# Remove binaries
	-sudo rm -f $(BIN_DIR)/api-gateway $(BIN_DIR)/camera-proxy $(BIN_DIR)/capture-daemon-new $(BIN_PATH)
	
	# Remove service files
	-sudo rm -f $(SYSTEMD_DIR)/api-gateway.service $(SYSTEMD_DIR)/camera-proxy.service $(SYSTEMD_DIR)/capture-daemon.service $(SERVICE_DST)
	
	# Reload systemd
	sudo systemctl daemon-reload
	
	@echo "Uninstall complete. Data directories preserved."

# =============================================================================
# LEGACY COMPATIBILITY (keep existing targets)
# =============================================================================

# Keep your existing targets for backward compatibility
build: build-legacy ## Legacy: build capture daemon
install: build install-bin install-service enable-service restart-service ## Legacy: full install
install-bin: ## Legacy: install binary only
	sudo install -m755 $(BIN_NAME) $(BIN_PATH)
install-service: ## Legacy: install service only
	sudo install -m644 $(SERVICE_SRC) $(SERVICE_DST)
enable-service: ## Legacy: enable service
	sudo systemctl daemon-reload
	sudo systemctl enable camera-record.service
restart-service: ## Legacy: restart service
	sudo systemctl restart camera-record.service
uninstall: ## Legacy: uninstall capture daemon
	-sudo rm -f $(BIN_PATH) $(SERVICE_DST)
	-sudo systemctl disable camera-record.service
	-sudo systemctl stop camera-record.service
	sudo systemctl daemon-reload

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