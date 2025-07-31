# Makefile for hotspot-installer

# Runs from docker/hotspot-installer/ but uses secrets from ../../secrets/

# 

# Usage:

# make token          # generate new token

# make build          # build image with token hash

# make dry-run        # show what would be configured

# make apply          # apply configuration to host

# make compose-up     # run via docker-compose

# make clean          # remove token and image

.PHONY: help token build dry-run apply compose-up compose-down ansible k8s-deploy k8s-clean clean

# Default target

help:
@echo "ThatDAMToolbox Hotspot Installer"
@echo ""
@echo "Targets:"
@echo "  token          Generate new ephemeral token"
@echo "  build          Build installer image (requires token)"
@echo "  dry-run        Run installer in dry-run mode"
@echo "  apply          Apply configuration to host"
@echo "  compose-up     Run via docker-compose"
@echo "  compose-down   Stop docker-compose"
@echo "  ansible        Deploy via ansible playbook"
@echo "  k8s-deploy     Deploy to kubernetes"
@echo "  k8s-clean      Clean kubernetes resources"
@echo "  clean          Remove token and built image"
@echo ""
@echo "Files:"
@echo "  Token: ../../secrets/dam_token.txt"
@echo "  Image: thatdam-hotspot-installer:latest"

# Paths relative to root (../../)

ROOT_DIR := ../..
SECRETS_DIR := $(ROOT_DIR)/secrets
TOKEN_FILE := $(SECRETS_DIR)/dam_token.txt
COMPOSE_FILE := docker-compose.hotspot-installer.yaml

# Check if token exists

$(TOKEN_FILE):
@echo "❌ Token not found at $(TOKEN_FILE)"
@echo "Run: make token"
@exit 1

# Generate new token

token:
@mkdir -p $(SECRETS_DIR)
@openssl rand -hex 32 > $(TOKEN_FILE)
@chmod 600 $(TOKEN_FILE)
@echo "✅ Generated new token: $(TOKEN_FILE)"

# Get token SHA for build

token-sha: $(TOKEN_FILE)
@sha256sum $(TOKEN_FILE) | cut -d’ ’ -f1

# Build the installer image

build: $(TOKEN_FILE)
@echo "🔨 Building hotspot-installer image…"
@export EPHEMERAL_TOKEN_SHA=$$(sha256sum $(TOKEN_FILE) | cut -d’ ’ -f1) &&   
docker build -t thatdam-hotspot-installer:latest   
–build-arg EPHEMERAL_TOKEN_SHA=$$EPHEMERAL_TOKEN_SHA   
.
@echo "✅ Built: thatdam-hotspot-installer:latest"

# Dry-run (interactive)

dry-run: build
@echo "🔍 Running dry-run (will prompt for confirmation)…"
@docker run -it –rm –privileged –network host   
-e SETUP_TOKEN=$$(cat $(TOKEN_FILE))   
thatdam-hotspot-installer:latest

# Apply immediately

apply: build
@echo "⚡ Applying configuration to host…"
@docker run –rm –privileged –network host   
-e SETUP_TOKEN=$$(cat $(TOKEN_FILE))   
thatdam-hotspot-installer:latest /setup.sh apply

# Docker Compose operations

compose-build: $(TOKEN_FILE)
@echo "🔨 Building via docker-compose…"
@cd $(ROOT_DIR) &&   
export EPHEMERAL_TOKEN_SHA=$$(sha256sum $(TOKEN_FILE) | cut -d’ ’ -f1) &&   
docker-compose -f docker/hotspot-installer/$(COMPOSE_FILE) build

compose-up: compose-build
@echo "🚀 Running via docker-compose (dry-run)…"
@cd $(ROOT_DIR) &&   
docker-compose -f docker/hotspot-installer/$(COMPOSE_FILE) up

compose-apply: compose-build
@echo "⚡ Applying via docker-compose…"
@cd $(ROOT_DIR) &&   
docker-compose -f docker/hotspot-installer/$(COMPOSE_FILE) run hotspot-installer /setup.sh apply

compose-down:
@echo "🛑 Stopping docker-compose…"
@cd $(ROOT_DIR) &&   
docker-compose -f docker/hotspot-installer/$(COMPOSE_FILE) down

# Ansible deployment

ansible: $(TOKEN_FILE)
@echo "📡 Deploying via Ansible…"
@if [ ! -f $(ROOT_DIR)/ansible/inventory ]; then   
echo "❌ Ansible inventory not found at $(ROOT_DIR)/ansible/inventory";   
exit 1;   
fi
@cd $(ROOT_DIR) &&   
ansible-playbook -i ansible/inventory   
docker/hotspot-installer/ansible/playbook.yml   
–ask-vault-pass

# Kubernetes operations

k8s-secret: $(TOKEN_FILE)
@echo "🔐 Creating kubernetes secret…"
@kubectl create secret generic dam-ephemeral-token   
–from-file=token=$(TOKEN_FILE)   
–dry-run=client -o yaml | kubectl apply -f -

k8s-deploy: k8s-secret
@echo "☸️  Deploying to kubernetes…"
@kubectl apply -f k8s/deployment.yml

k8s-clean:
@echo "🧹 Cleaning kubernetes resources…"
@kubectl delete -f k8s/deployment.yml –ignore-not-found
@kubectl delete secret dam-ephemeral-token –ignore-not-found

# Development helpers

logs:
@echo "📋 Showing service logs on host…"
@sudo journalctl -u nginx -u avahi-daemon -u hostapd -u dnsmasq -f

status:
@echo "📊 Service status on host…"
@systemctl status nginx avahi-daemon hostapd dnsmasq –no-pager || true
@echo ""
@echo "Network interfaces:"
@ip -br addr show || true

# Start services (after apply)

start:
@echo "🎯 Starting all services…"
@sudo /usr/local/bin/start-services.sh

# Stop services

stop:
@echo "🛑 Stopping all services…"
@sudo systemctl stop nginx avahi-daemon hostapd dnsmasq || true

# Check if token is valid

verify-token: $(TOKEN_FILE)
@echo "🔍 Verifying token…"
@if [ $$(wc -c < $(TOKEN_FILE)) -eq 65 ]; then   
echo "✅ Token length correct (64 hex chars + newline)";   
else   
echo "❌ Token length incorrect";   
exit 1;   
fi
@echo "Token SHA: $$(sha256sum $(TOKEN_FILE) | cut -d’ ’ -f1)"

# Cleanup

clean:
@echo "🧹 Cleaning up…"
@docker rmi thatdam-hotspot-installer:latest 2>/dev/null || true
@rm -f $(TOKEN_FILE)
@echo "✅ Cleaned: image and token removed"

# Reset host configuration

reset-host:
@echo "🔄 Resetting host configuration…"
@sudo systemctl disable –now nginx avahi-daemon hostapd dnsmasq 2>/dev/null || true
@sudo rm -rf /etc/thatdamtoolbox/ 2>/dev/null || true
@sudo rm -f /etc/nginx/sites-available/thatdam 2>/dev/null || true
@sudo rm -f /etc/nginx/sites-enabled/thatdam 2>/dev/null || true
@sudo rm -f /etc/avahi/services/thatdam.service 2>/dev/null || true
@sudo rm -f /etc/hostapd/hostapd.conf 2>/dev/null || true
@sudo rm -f /etc/dnsmasq.d/thatdam.conf 2>/dev/null || true
@sudo rm -f /usr/local/bin/start-services.sh 2>/dev/null || true
@echo "✅ Host configuration reset"

# Show current token (if exists)

show-token: $(TOKEN_FILE)
@echo "Current token:"
@cat $(TOKEN_FILE)
@echo ""
@echo "SHA256: $$(sha256sum $(TOKEN_FILE) | cut -d’ ’ -f1)"