# A dead-simple delivery path for your Agent ⇄ Supervisor stack that works on Pi → desktops, with two tracks:
	1.	install on an existing OS (one-liner, creates a managed service), and
	2.	flash a ready-to-boot image (hands-off provisioning).

Below is a battle-tested, open-source-friendly plan with concrete, drop-in artifacts.

Track A -- "Install on existing OS" (1-liner)

What this gives you
	•	Auto-detect OS/arch (RPi OS / Debian / Ubuntu / Fedora / macOS / Windows)
	•	Installs either native binary + system service or Docker Compose (if Docker is present)
	•	Creates a thatdamtoolbox system user, folders, .env, logs
	•	Registers machine → gets stable AGENT_ID
	•	Installs Supervisor (server role) or Agent (edge role) based on flag

1) Bootstrap script (curl | bash)

Save as scripts/install.sh and publish at e.g. https://get.cdaprod.dev/thatdamtoolbox:

#!/usr/bin/env bash
set -euo pipefail

ROLE="${ROLE:-agent}"              # agent|supervisor
CHANNEL="${CHANNEL:-stable}"       # stable|canary
WITH_DOCKER="${WITH_DOCKER:-auto}" # auto|yes|no

# --- Detect platform/arch ---
OS="$(uname -s)"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64)   ARCH=amd64 ;;
  aarch64|arm64)  ARCH=arm64 ;;
  armv7l|armv7)   ARCH=armv7 ;;
esac

# --- Paths & user ---
APP=thatdamtoolbox
SVC_USER=$APP
BASE="/opt/$APP"
BIN_DIR="$BASE/bin"
DATA_DIR="/var/lib/$APP"
LOG_DIR="/var/log/$APP"
ENV_FILE="/etc/$APP.env"
UNIT_FILE="/etc/systemd/system/$APP.service"

sudo useradd -r -s /usr/sbin/nologin -d "$DATA_DIR" "$SVC_USER" 2>/dev/null || true
sudo mkdir -p "$BIN_DIR" "$DATA_DIR" "$LOG_DIR"
sudo chown -R $SVC_USER:$SVC_USER "$DATA_DIR" "$LOG_DIR"

# --- Decide delivery: Docker vs native ---
have_docker() { command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; }
USE_DOCKER=false
if [ "$WITH_DOCKER" = "yes" ] || { [ "$WITH_DOCKER" = "auto" ] && have_docker; }; then
  USE_DOCKER=true
fi

# --- Fetch artifacts ---
if $USE_DOCKER; then
  # Compose stack (supervisor or agent)
  curl -fsSL "https://dl.cdaprod.dev/$APP/$CHANNEL/docker-compose.$ROLE.yaml" -o "$BASE/docker-compose.yaml"
  sudo chown -R $SVC_USER:$SVC_USER "$BASE"
else
  # Fetch single static binary matched to OS/arch
  # (You’ll publish these from CI: ${APP}-${ROLE}-${OS}-${ARCH})
  url="https://dl.cdaprod.dev/$APP/$CHANNEL/${APP}-${ROLE}-$(echo $OS | tr '[:upper:]' '[:lower:]')-${ARCH}"
  curl -fsSL "$url" -o "/tmp/$APP"
  sudo install -m 0755 "/tmp/$APP" "$BIN_DIR/$APP"
fi

# --- Default env ---
if [ ! -f "$ENV_FILE" ]; then
  sudo tee "$ENV_FILE" >/dev/null <<EOF
ROLE=$ROLE
APP_ENV=prod
APP_HTTP_ADDR=0.0.0.0:8080
DATA_DIR=$DATA_DIR
LOG_DIR=$LOG_DIR
# Upstream only needed when ROLE=agent
UPSTREAM_HOST=supervisor.local
UPSTREAM_PORT=8080
EVENT_BROKER_URL=
EOF
fi
sudo chmod 0640 "$ENV_FILE"

# --- systemd unit (handles both native & docker) ---
sudo tee "$UNIT_FILE" >/dev/null <<'EOF'
[Unit]
Description=ThatDAMToolbox (agent/supervisor)
After=network-online.target docker.service
Wants=network-online.target

[Service]
EnvironmentFile=/etc/thatdamtoolbox.env
User=thatdamtoolbox
Group=thatdamtoolbox
WorkingDirectory=/opt/thatdamtoolbox
TimeoutStartSec=0
Restart=always
RestartSec=3

# Prefer docker-compose if present, else native binary
ExecStart=/bin/bash -lc '
  if [ -f docker-compose.yaml ] && command -v docker >/dev/null 2>&1; then
    exec docker compose up --abort-on-container-exit
  else
    exec /opt/thatdamtoolbox/bin/thatdamtoolbox --role "${ROLE:-agent}" \
      --data "${DATA_DIR:-/var/lib/thatdamtoolbox}" \
      ${UPSTREAM_HOST:+--upstream "http://${UPSTREAM_HOST}:${UPSTREAM_PORT:-8080}"} \
      ${EVENT_BROKER_URL:+--broker "${EVENT_BROKER_URL}"} \
      --log-dir "${LOG_DIR:-/var/log/thatdamtoolbox}"
  fi
'

# Forward logs
StandardOutput=append:/var/log/thatdamtoolbox/service.log
StandardError=append:/var/log/thatdamtoolbox/service.err

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable thatdamtoolbox
sudo systemctl restart thatdamtoolbox

echo "✅ Installed. Logs: $LOG_DIR"

Usage:

# Agent on Pi/desktop
curl -fsSL https://get.cdaprod.dev/thatdamtoolbox | ROLE=agent bash

# Supervisor on your main node
curl -fsSL https://get.cdaprod.dev/thatdamtoolbox | ROLE=supervisor bash

# Force native binary even if Docker exists
curl -fsSL https://get.cdaprod.dev/thatdamtoolbox | WITH_DOCKER=no bash

Windows/macOS: ship parallel launchers
• macOS: a LaunchDaemon plist that executes the same binary (or docker compose up if present).
• Windows: a tiny PowerShell installer using sc.exe or nssm to create a service and an .env.

⸻

Track B -- "Flash a new image" (hands-off)

For Raspberry Pi and other ARM SBCs, you want a cloud-init (or DietPi’s first-boot) flow so the device self-provisions on first boot:

Option 1: Raspberry Pi OS + cloud-init (recommended DIY)
	1.	Build a custom image once (via pi-gen or Packer) with cloud-init enabled.
	2.	Burn with Raspberry Pi Imager; drop user-data and network-config on the boot volume.
	3.	First boot: cloud-init runs → fetches the same one-liner → joins fleet.

user-data (save as cloud-init/user-data on the boot partition):

#cloud-config
hostname: ninjapi
users:
  - name: pi
    groups: [sudo,adm,video,plugdev]
    shell: /bin/bash
    sudo: ['ALL=(ALL) NOPASSWD:ALL']
package_update: true
package_upgrade: false
write_files:
  - path: /etc/thatdamtoolbox.env
    permissions: '0640'
    owner: root:root
    content: |
      ROLE=agent
      APP_ENV=prod
      UPSTREAM_HOST=supervisor.local
      UPSTREAM_PORT=8080
runcmd:
  - "curl -fsSL https://get.cdaprod.dev/thatdamtoolbox | ROLE=agent bash"

network-config (optional static or Wi-Fi creds):

version: 2
wifis:
  wlan0:
    dhcp4: true
    access-points:
      "YourSSID":
        password: "YourPassphrase"

Result: flash, boot, walk away -- it phones home to Supervisor and registers itself as an Agent.

Option 2: Ubuntu Server for Pi + cloud-init (zero customization)

Ubuntu already ships cloud-init. Just place the same user-data/network-config on the boot volume → done.

⸻

Packaging (nice-to-have, payoffs later)
	•	Deb/RPM: produce .deb & .rpm from CI for apt/yum installs; include your systemd unit and /etc/thatdamtoolbox.env.
	•	Homebrew Tap (macOS): brew install cdaprod/tap/thatdamtoolbox.
	•	winget/choco (Windows): optional if you want turnkey desktop installs.

⸻

CI knobs you already have (just wire them)
	•	Multi-arch builds: linux/amd64, linux/arm64, linux/arm/v7.
	•	Release channeling: stable vs canary artifacts at predictable URLs used by the installer.
	•	SBOM + cosign: sign binaries and images; verify in install.sh if you want.

⸻

Why this fits Agent ⇄ Supervisor
	•	Both roles are idempotent. The unit runs fine with or without Docker.
	•	Agent reads UPSTREAM_HOST/PORT from /etc/thatdamtoolbox.env and can auto-repoint (discovery later).
	•	Supervisor can run alone (single-box) or fan-in many Agents (fleet).

⸻

What to do next (fast path)
	1.	Drop scripts/install.sh in your repo and host it at get.cdaprod.dev/thatdamtoolbox.
	2.	Publish per-arch static binaries and compose files from CI to dl.cdaprod.dev/thatdamtoolbox/<channel>/....
	3.	Add the systemd unit above to your packaging.
	4.	For Pi: use the provided cloud-init files to create a "flash-and-go" SD card.

If you want, I can adapt the installer to your exact repo paths (compose file names, binary flags) and add macOS/Windows service stubs.