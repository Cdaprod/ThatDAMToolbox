SHELL := /bin/bash
.ONESHELL:
ENV_FILE ?= ./ops/ci/vars.env
IMG_SH   ?= ./ops/ci/image.sh
DATE_ISO ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
GIT_SHA  ?= $(shell git rev-parse --short=12 HEAD)

# Makefile for dynamic image build and tagging
# Usage: make release/edge ENV_FILE=ops/ci/vars.env

define load_env
set -a; [ -f $(ENV_FILE) ] && . $(ENV_FILE); set +a
endef

.PHONY: print/matrix
print/matrix:
	@$(load_env); bash $(IMG_SH) $(ENV_FILE) print_matrix

.PHONY: login/ghcr
login/ghcr:
	@echo "$${GHCR_TOKEN:-$${GITHUB_TOKEN:-}}" | docker login ghcr.io -u "$${GHCR_USER:-$${GITHUB_ACTOR:-'cdaprod'}}" --password-stdin

.PHONY: build/edge
build/edge:
	@$(load_env); EDGE_REF=$$(bash $(IMG_SH) $(ENV_FILE) image_ref $$SERVICE_EDGE); MATRIX=$${TARGET_PLATFORMS:-linux/amd64,linux/arm64}; docker buildx create --use >/dev/null 2>&1 || true; docker buildx build --platform $$MATRIX -f docker/edge/Dockerfile --build-arg VERSION=$$VERSION --build-arg GIT_SHA=$(GIT_SHA) --build-arg CHANNEL=$$CHANNEL --build-arg BUILD_DATE=$(DATE_ISO) --build-arg MATRIX=$$MATRIX -t $$EDGE_REF --push . ; echo "Built $$EDGE_REF"

.PHONY: tag/edge
tag/edge:
	@$(load_env); EDGE_REF=$$(bash $(IMG_SH) $(ENV_FILE) image_ref $$SERVICE_EDGE); EDGE_CH=$$(bash $(IMG_SH) $(ENV_FILE) channel_tag $$SERVICE_EDGE); EDGE_LT=$$(bash $(IMG_SH) $(ENV_FILE) latest_tag $$SERVICE_EDGE); DIGEST=$$(bash $(IMG_SH) $(ENV_FILE) digest $$EDGE_REF); echo "Digest: $$DIGEST"; docker buildx imagetools create -t $$EDGE_CH $$EDGE_REF@$$DIGEST; if [[ "$$CHANNEL" != "prod" ]]; then docker buildx imagetools create -t $$EDGE_LT $$EDGE_REF@$$DIGEST; fi; echo "Tagged channel: $$EDGE_CH"

.PHONY: echo/edge-digest
echo/edge-digest:
	@$(load_env); EDGE_REF=$$(bash $(IMG_SH) $(ENV_FILE) image_ref $$SERVICE_EDGE); DIGEST=$$(bash $(IMG_SH) $(ENV_FILE) digest $$EDGE_REF); echo "$$EDGE_REF@$$DIGEST"

.PHONY: release/edge
release/edge: login/ghcr build/edge tag/edge
	@echo "Release done → ENV_FILE=$(ENV_FILE)"
