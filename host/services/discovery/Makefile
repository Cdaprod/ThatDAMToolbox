# Makefile for ThatDAM Discovery Service
.PHONY: help build start stop status monitor cleanup logs install

# Default target
.DEFAULT_GOAL := help

# Configuration
PROJECT_NAME := thatdamtoolbox
DISCOVERY_SERVICE := thatdam-discovery
DISCOVERY_DIR := host/services/discovery

# Colors
YELLOW := \033[1;33m
GREEN := \033[0;32m
BLUE := \033[0;34m
RED := \033[0;31m
NC := \033[0m

## Show this help message
help:
	@echo -e "$(YELLOW)ThatDAM Discovery Service$(NC)"
	@echo -e "$(BLUE)Available targets:$(NC)\n"
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-12s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) }' $(MAKEFILE_LIST)

##@ Development
## Build the discovery service binary
build:
	@echo -e "$(BLUE)Building discovery service...$(NC)"
	cd $(DISCOVERY_DIR) && go mod tidy
	cd $(DISCOVERY_DIR) && go build -o discovery-service .
	@echo -e "$(GREEN)✅ Discovery service built$(NC)"

## Build Docker image for discovery service
build-image:
	@echo -e "$(BLUE)Building Docker image...$(NC)"
	docker build -t $(DISCOVERY_SERVICE):latest -f $(DISCOVERY_DIR)/Dockerfile .
	@echo -e "$(GREEN)✅ Docker image built$(NC)"

## Install dependencies and setup
install:
	@echo -e "$(BLUE)Installing dependencies...$(NC)"
	@if ! command -v docker >/dev/null 2>&1; then \
		echo -e "$(RED)❌ Docker not found. Please install Docker first.$(NC)"; \
		exit 1; \
	fi
	@if ! command -v docker-compose >/dev/null 2>&1; then \
		echo -e "$(RED)❌ docker-compose not found. Please install docker-compose first.$(NC)"; \
		exit 1; \
	fi
	@echo -e "$(GREEN)✅ Dependencies verified$(NC)"
	chmod +x startup.sh
	@echo -e "$(GREEN)✅ Startup script made executable$(NC)"

##@ Service Management
## Start the discovery system
start:
	@echo -e "$(BLUE)Starting ThatDAM Discovery System...$(NC)"
	./startup.sh start

## Stop all services
stop:
	@echo -e "$(BLUE)Stopping services...$(NC)"
	./startup.sh stop

## Show service status
status:
	@echo -e "$(BLUE)Checking service status...$(NC)"
	./startup.sh status

## Monitor services in real-time
monitor:
	@echo -e "$(BLUE)Starting service monitor...$(NC)"
	./startup.sh monitor

## Show discovery service logs
logs:
	@echo -e "$(BLUE)Showing discovery logs...$(NC)"
	./startup.sh logs

##@ Maintenance
## Clean up containers and networks
cleanup:
	@echo -e "$(YELLOW)Cleaning up...$(NC)"
	./startup.sh cleanup

## Full cleanup including volumes (DESTRUCTIVE)
clean-all:
	@echo -e "$(RED)⚠️  This will delete all data! Continue? [y/N]$(NC)" && read ans && [ $${ans:-N} = y ]
	CLEAN_VOLUMES=true ./startup.sh cleanup

## Restart services
restart: stop start

##@ Discovery Backends
## Start with mDNS discovery (local network only)
start-mdns:
	@echo -e "$(BLUE)Starting with mDNS discovery...$(NC)"
	DISCOVERY_BACKEND=mdns ./startup.sh start

## Start with Serf discovery (specify SERF_JOIN=ip:port)
start-serf:
	@echo -e "$(BLUE)Starting with Serf discovery...$(NC)"
	@if [ -z "$(SERF_JOIN)" ]; then \
		echo -e "$(RED)❌ Please set SERF_JOIN environment variable (e.g., make start-serf SERF_JOIN=192.168.1.100:7946)$(NC)"; \
		exit 1; \
	fi
	DISCOVERY_BACKEND=serf SERF_JOIN=$(SERF_JOIN) ./startup.sh start

## Start with Tailscale discovery
start-tailscale:
	@echo -e "$(BLUE)Starting with Tailscale discovery...$(NC)"
	DISCOVERY_BACKEND=tailscale ./startup.sh start

##@ Testing
## Test discovery functionality
test-discovery:
	@echo -e "$(BLUE)Testing discovery endpoints...$(NC)"
	@echo "Health check:"
	@curl -sf http://localhost:9999/health | jq . || echo "❌ Health check failed"
	@echo -e "\nDiscovery info:"
	@curl -sf http://localhost:9999/discovery | jq . || echo "❌ Discovery info failed"

## Run integration tests
test-integration:
	@echo -e "$(BLUE)Running integration tests...$(NC)"
	cd $(DISCOVERY_DIR) && go test -v ./...

##@ Development Helpers
## Follow all container logs
logs-all:
	@echo -e "$(BLUE)Following all container logs...$(NC)"
	docker-compose logs -f

## Show running containers
ps:
	@echo -e "$(BLUE)Running containers:$(NC)"
	docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep $(PROJECT_NAME) || echo "No containers running"

## Show Docker networks
networks:
	@echo -e "$(BLUE)Docker networks:$(NC)"
	docker network ls | grep $(PROJECT_NAME) || echo "No project networks found"

## Show Docker volumes
volumes:
	@echo -e "$(BLUE)Docker volumes:$(NC)"
	docker volume ls | grep $(PROJECT_NAME) || echo "No project volumes found"

##@ Quick Actions
## Deploy on new host (first-time setup)
deploy: install build-image start
	@echo -e "$(GREEN)🚀 Deployment complete!$(NC)"
	@echo -e "$(BLUE)Use 'make status' to check services$(NC)"

## Update and restart
update: build-image restart
	@echo -e "$(GREEN)🔄 Update complete!$(NC)"

## Emergency stop (force kill all containers)
emergency-stop:
	@echo -e "$(RED)🚨 Emergency stop - killing all containers...$(NC)"
	docker ps -q --filter "name=$(PROJECT_NAME)" | xargs -r docker kill
	docker ps -aq --filter "name=$(PROJECT_NAME)" | xargs -r docker rm

##@ Configuration
## Show current configuration
config:
	@echo -e "$(BLUE)Current Configuration:$(NC)"
	@echo -e "  Project Name: $(YELLOW)$(PROJECT_NAME)$(NC)"
	@echo -e "  Discovery Service: $(YELLOW)$(DISCOVERY_SERVICE)$(NC)"
	@echo -e "  Discovery Backend: $(YELLOW)$${DISCOVERY_BACKEND:-auto}$(NC)"
	@echo -e "  Serf Join: $(YELLOW)$${SERF_JOIN:-not set}$(NC)"
	@echo -e "  Log Level: $(YELLOW)$${LOG_LEVEL:-info}$(NC)"

## Set development environment
dev-env:
	@echo -e "$(BLUE)Setting up development environment...$(NC)"
	@echo "export DISCOVERY_BACKEND=mdns" >> .env.local
	@echo "export LOG_LEVEL=debug" >> .env.local
	@echo -e "$(GREEN)✅ Development environment configured$(NC)"
	@echo -e "$(BLUE)Source .env.local or restart shell$(NC)"

## Set production environment
prod-env:
	@echo -e "$(BLUE)Setting up production environment...$(NC)"
	@echo "export DISCOVERY_BACKEND=serf" >> .env.local
	@echo "export LOG_LEVEL=info" >> .env.local
	@echo -e "$(GREEN)✅ Production environment configured$(NC)"
	@echo -e "$(BLUE)Don't forget to set SERF_JOIN for clustering$(NC)"