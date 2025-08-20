# infra.mk - Infra layer bootstrapping targets for That DAM Toolbox
#
# Included from the root Makefile to build and manage the optional
# infrastructure services.
# Example:
#   make infra-up-all

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
