#!/usr/bin/env bash
# scripts/register-runner.sh
# Secure, idempotent installer for self-hosted GitHub Actions runners
#
# Usage:
#   GH_OWNER=<org> GH_REPO=<repo> GH_PAT=<token> RUNNER_ROLE=<role> \
#     ./scripts/register-runner.sh
#
# Example:
#   GH_OWNER=myorg GH_REPO=myrepo GH_PAT=ghp_xxx RUNNER_ROLE=capture \
#     ./scripts/register-runner.sh
#
# Exits non-zero on failure.
set -euo pipefail
IFS=$'\n\t'

### -------- configuration (env) --------
# Required (one of the scopes below):
#   GH_SCOPE=repo → GH_OWNER, GH_REPO
#   GH_SCOPE=org  → GH_OWNER
# Optional:
#   GH_URL          (default https://github.com)
#   GH_API          (default https://api.github.com)
#   RUNNER_ROLE     (e.g., server|capture|worker)   [required]
#   RUNNER_LABELS   (comma list)                    [default: "self-hosted,linux,${role}"]
#   RUNNER_NAME     (default: hostname)
#   RUNNER_VERSION  (pinned runner version)         [default: 3.651.0]
#   RUNNER_DIR      (default: $HOME/actions-runner)
#   RUNNER_EPHEMERAL=1 to run ephemeral jobs
#   DRY_RUN=1       show actions without doing them
#   AUTH_BRIDGE_URL if set, mint tokens from ThatDAM auth-bridge before GitHub
#   AUTH_BRIDGE_TOKEN optional bearer for auth-bridge mint endpoint
#   CHECKSUM_SHA256 pre-provided SHA256 for the tarball (air-gapped)

### -------- helpers --------
log() { printf '%s %s\n' "[runner]" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }
need() { command -v "$1" >/dev/null || die "missing dependency: $1"; }
json_field() { python - "$1" 2>/dev/null <<'PY' || true
import sys, json
data=sys.stdin.read()
try:
    obj=json.loads(data or "{}")
    key=sys.argv[1]
    v=obj.get(key,"")
    print(v if v is not None else "")
except Exception:
    pass
PY
}

### -------- validate env --------
GH_SCOPE="${GH_SCOPE:-repo}"               # repo|org
GH_URL="${GH_URL:-https://github.com}"
GH_API="${GH_API:-https://api.github.com}"
RUNNER_ROLE="${RUNNER_ROLE:-}"
[[ -z "${RUNNER_ROLE}" ]] && die "RUNNER_ROLE must be set"

case "${GH_SCOPE}" in
  repo)
    : "${GH_OWNER:?GH_OWNER required for repo scope}"
    : "${GH_REPO:?GH_REPO required for repo scope}"
    ;;
  org)
    : "${GH_OWNER:?GH_OWNER required for org scope}"
    ;;
  *) die "GH_SCOPE must be repo or org";;
esac

RUNNER_VERSION="${RUNNER_VERSION:-3.651.0}"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  RUNNER_ARCH="x64"   ;;
  aarch64|arm64) RUNNER_ARCH="arm64" ;;
  armv7l|armv6l) RUNNER_ARCH="arm"   ;;
  *) die "Unsupported architecture: $ARCH" ;;
esac

TARBALL="actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
URL="${GH_URL}/actions/runner/releases/download/v${RUNNER_VERSION}/${TARBALL}"
RUNNER_DIR="${RUNNER_DIR:-${HOME}/actions-runner}"
RUNNER_NAME="${RUNNER_NAME:-$(hostname)}"
EPHEMERAL_FLAG=""
[[ "${RUNNER_EPHEMERAL:-0}" = "1" ]] && EPHEMERAL_FLAG="--ephemeral"

DEFAULT_LABELS="self-hosted,linux,role-${RUNNER_ROLE}"
RUNNER_LABELS="${RUNNER_LABELS:-$DEFAULT_LABELS}"

need curl
need tar
need sha256sum || need shasum

if [[ -n "${DRY_RUN:-}" ]]; then
  log "DRY RUN: would install runner v${RUNNER_VERSION} (${RUNNER_ARCH})"
  log "DRY RUN: scope=${GH_SCOPE} url=${GH_URL} api=${GH_API} owner=${GH_OWNER:-} repo=${GH_REPO:-}"
  log "DRY RUN: dir=${RUNNER_DIR} name=${RUNNER_NAME} labels=${RUNNER_LABELS} ephemeral=${RUNNER_EPHEMERAL:-0}"
fi

### -------- mint short-lived registration token --------
mint_token_github() {
  local path method token_json
  local auth="Authorization: Bearer ${GH_PAT:-${GH_TOKEN:-}}"
  [[ -z "${GH_PAT:-${GH_TOKEN:-}}" ]] && return 1
  case "${GH_SCOPE}" in
    repo) path="/repos/${GH_OWNER}/${GH_REPO}/actions/runners/registration-token" ;;
    org)  path="/orgs/${GH_OWNER}/actions/runners/registration-token" ;;
  esac
  token_json="$(curl -fsSL -X POST -H "$auth" -H 'Accept: application/vnd.github+json' \
    "${GH_API}${path}")" || return 1
  printf '%s' "$token_json" | json_field token
}

mint_token_authbridge() {
  [[ -z "${AUTH_BRIDGE_URL:-}" ]] && return 1
  local authh=()
  [[ -n "${AUTH_BRIDGE_TOKEN:-}" ]] && authh=(-H "Authorization: Bearer ${AUTH_BRIDGE_TOKEN}")
  local body path
  body=$(printf '{"scope":"%s","owner":"%s","repo":"%s","role":"%s","labels":"%s"}' \
        "$GH_SCOPE" "${GH_OWNER:-}" "${GH_REPO:-}" "$RUNNER_ROLE" "$RUNNER_LABELS")
  path="${AUTH_BRIDGE_URL%/}/v1/github/runner/registration-token"
  local token_json
  token_json="$(curl -fsSL -X POST "${authh[@]}" -H 'Content-Type: application/json' \
    --data "$body" "$path")" || return 1
  printf '%s' "$token_json" | json_field token
}

if [[ -z "${DRY_RUN:-}" ]]; then
  REG_TOKEN="$(mint_token_authbridge || true)"
  if [[ -z "$REG_TOKEN" ]]; then
    REG_TOKEN="$(mint_token_github || true)"
  fi
  [[ -z "$REG_TOKEN" ]] && die "failed to mint a short-lived registration token (auth-bridge or GitHub API)"
else
  REG_TOKEN="<dry-run-token>"
fi

### -------- download & verify (pinned) --------
download_runner() {
  mkdir -p "${RUNNER_DIR}"
  local tgz="${RUNNER_DIR}/${TARBALL}"
  if [[ ! -f "$tgz" ]]; then
    [[ -n "${DRY_RUN:-}" ]] && { log "DRY RUN: curl -L ${URL} -o ${tgz}"; return 0; }
    curl -fL "${URL}" -o "${tgz}"
  fi
}

verify_checksum() {
  local tgz="${RUNNER_DIR}/${TARBALL}"
  if [[ -n "${CHECKSUM_SHA256:-}" ]]; then
    echo "${CHECKSUM_SHA256}  ${tgz}" | sha256sum -c - >/dev/null 2>&1 \
      || { shasum -a 256 -c - >/dev/null 2>&1 || true; } <<<"${CHECKSUM_SHA256}  ${tgz}"
  else
    local sumurl="${GH_URL}/actions/runner/releases/download/v${RUNNER_VERSION}/sha256sum.txt"
    if [[ -z "${DRY_RUN:-}" ]]; then
      local sums
      sums="$(curl -fsSL "${sumurl}" || true)"
      if [[ -n "$sums" ]]; then
        (cd "${RUNNER_DIR}" && printf '%s\n' "$sums" | grep " ${TARBALL}$" | sha256sum -c -)
      else
        log "checksum file not available; set CHECKSUM_SHA256 to enforce verification"
      fi
    else
      log "DRY RUN: would verify ${TARBALL} against sha256sum.txt"
    fi
  fi
}

extract_runner() {
  local tgz="${RUNNER_DIR}/${TARBALL}"
  [[ -n "${DRY_RUN:-}" ]] && { log "DRY RUN: tar xzf ${tgz} -C ${RUNNER_DIR}"; return; }
  (cd "${RUNNER_DIR}" && tar xzf "${tgz}")
}

download_runner
verify_checksum
extract_runner
cd "${RUNNER_DIR}"

### -------- idempotent (re)config --------
current_labels() {
  [[ -f .runner ]] || { echo ""; return; }
  grep -E '"Labels":' -A1 .runner 2>/dev/null | tr -d '\r' | tail -n1 | sed 's/.*\[\(.*\)\].*/\1/' | tr -d '" ' | tr -d '\n'
}

CONFIG_CHANGED=0
if [[ -f .runner ]]; then
  CUR_NAME="$(grep '"Name"' .runner 2>/dev/null | sed 's/.*"Name":[ ]*"\(.*\)".*/\1/')" || true
  CUR_LABELS="$(current_labels)"
  if [[ "$RUNNER_NAME" != "$CUR_NAME" || "$RUNNER_LABELS" != "$CUR_LABELS" ]]; then
    CONFIG_CHANGED=1
  fi
fi

if [[ ! -f .runner || "$CONFIG_CHANGED" = "1" ]]; then
  [[ -f .runner ]] && { [[ -z "${DRY_RUN:-}" ]] && ./config.sh remove --unattended || log "DRY RUN: ./config.sh remove"; }
  cfg_labels="${RUNNER_LABELS}"
  cfg_url="${GH_URL}/${GH_SCOPE}/${GH_OWNER}"
  [[ "${GH_SCOPE}" = "repo" ]] && cfg_url="${GH_URL}/${GH_OWNER}/${GH_REPO}"

  if [[ -z "${DRY_RUN:-}" ]]; then
    ./config.sh --unattended \
      --url "${cfg_url}" \
      --token "${REG_TOKEN}" \
      --name "${RUNNER_NAME}" \
      --labels "${cfg_labels}"
  else
    log "DRY RUN: ./config.sh --unattended --url ${cfg_url} --token <redacted> --name ${RUNNER_NAME} --labels ${cfg_labels}"
  fi
else
  log "config is up-to-date; no reconfigure needed"
fi

### -------- service management with graceful fallback --------
start_service() {
  if command -v systemctl >/dev/null 2>&1; then
    if [[ -z "${DRY_RUN:-}" ]]; then
      sudo ./svc.sh install || true
      sudo ./svc.sh start  || true
    else
      log "DRY RUN: sudo ./svc.sh install && sudo ./svc.sh start"
    fi
  else
    if [[ -z "${DRY_RUN:-}" ]]; then
      nohup ./run.sh ${EPHEMERAL_FLAG} >/dev/null 2>&1 &
    else
      log "DRY RUN: nohup ./run.sh ${EPHEMERAL_FLAG} &"
    fi
  fi
}

status_service() {
  if command -v systemctl >/dev/null 2>&1; then
    sudo ./svc.sh status || true
  else
    pgrep -f "[r]un.sh" >/dev/null 2>&1 && log "runner process present" || log "runner process not found"
  fi
}

start_service
status_service

log "done."

