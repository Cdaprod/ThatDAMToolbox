# Hotspot-Installer (That DAM Toolbox)

#### Author: David Cannan

Run it once (dry-run first if you’d like):

```bash
# show diffs only
docker compose --profile setup run --rm hotspot-installer

# actually apply
SETUP_TOKEN=$(cat ./secrets/dam_token.txt) \
docker compose --profile setup run --rm \
       -e SETUP_TOKEN \
       hotspot-installer apply
``` 

---

This helper image turns a plain Raspberry Pi (or any Debian-based host) into a self-contained "That DAM Toolbox access point":

- serves your pre-built Next.js frontend over Nginx
- exposes the video-API & WebSockets through the same container
- advertises itself via mDNS/Avahi (thatdamtoolbox.local)
- spins up an optional Wi-Fi hotspot (ThatDAMToolbox / thatdam123) so phones can connect even when no LAN is available

Everything is done idempotently from one shell script (`setup.sh`) that can:

- **dry-run** – show coloured diffs of every file it would touch
- **apply** – write configs, enable services, then exit
- **token-gate** the execution so only your orchestrator can run it on real hardware

⸻

## Folder layout

```
docker/hotspot-installer/
├── Dockerfile                                # multi-stage builder + installer  
├── setup.sh                                 # all configuration logic (dry-run by default)
├── docker-compose.hotspot-installer.yaml    # compose integration with secrets
├── ansible/
│   └── playbook.yml                         # ansible vault integration
├── k8s/
│   └── deployment.yml                       # kubernetes deployment
└── README.md                                # you are here
```

⸻

## 1  Generate a one-time token

```bash
mkdir -p secrets
openssl rand -hex 32 > secrets/dam_token.txt   # 64-char random hex
```

Keep `secrets/` out of Git and `.dockerignore` (see root README).

⸻

## 2  Build the image (token hash only)

```bash
export EPHEMERAL_TOKEN_SHA=$(sha256sum secrets/dam_token.txt | cut -d' ' -f1)

docker build -t thatdam-hotspot-installer \
             --build-arg EPHEMERAL_TOKEN_SHA=$EPHEMERAL_TOKEN_SHA \
             docker/hotspot-installer
```

Only the SHA-256 of the token is baked into the image – the secret itself never leaves your disk.

⸻

## 3  Standalone usage

### Dry-run / interactive

```bash
docker run -it --rm --privileged --network host \
           -e SETUP_TOKEN=$(cat secrets/dam_token.txt) \
           thatdam-hotspot-installer
```

You’ll see a full diff of every change and be prompted `Apply these changes? [y/N]`.

### Apply immediately (CI / provisioning)

```bash
docker run --rm --privileged --network host \
           -e SETUP_TOKEN=$(cat secrets/dam_token.txt) \
           thatdam-hotspot-installer /setup.sh apply
```

When finished, configs live on the host (`/etc/nginx`, `/etc/avahi`, …) and the token is stored at `/etc/thatdamtoolbox/license.ephemeral` (600 permissions).

⸻

## 4  Docker Compose integration

```bash
# Build with token hash
export EPHEMERAL_TOKEN_SHA=$(sha256sum secrets/dam_token.txt | cut -d' ' -f1)

# Run the installer (dry-run by default)
docker-compose -f docker-compose.hotspot-installer.yaml up

# Or apply immediately
docker-compose -f docker-compose.hotspot-installer.yaml run hotspot-installer /setup.sh apply
```

The compose file handles:

- Secret mounting from `./secrets/dam_token.txt`
- Privileged container with host networking
- Proper build args for token SHA

⸻

## 5  Ansible integration

```bash
# Store token in ansible vault
ansible-vault create group_vars/all/vault.yml
# Add: dam_token: "your-64-char-hex-token"

# Deploy to raspberry pi
ansible-playbook -i inventory ansible/playbook.yml --ask-vault-pass
```

The playbook:

- Decrypts the vault token at runtime
- Copies it securely to the target host
- Runs the installer container with proper secrets mounting

⸻

## 6  Kubernetes deployment

```bash
# Create secret from token file
kubectl create secret generic dam-ephemeral-token \
  --from-file=token=secrets/dam_token.txt

# Deploy
kubectl apply -f k8s/deployment.yml
```

The K8s deployment uses:

- `hostNetwork: true` for hotspot functionality
- `privileged: true` security context
- Secret volume mounting at `/var/run/secrets/thatdam/token`

⸻

## 7  Environment variables

|Var                  |Default     |Use                                                   |
|---------------------|------------|------------------------------------------------------|
|`SETUP_TOKEN`        |(none)      |Paste the plain token for quick runs                  |
|`SETUP_TOKEN_FILE`   |(none)      |Path to file containing the token (e.g. Docker secret)|
|`APPLY`              |`0`         |When set to `1`, runs non-interactive apply mode      |
|`EPHEMERAL_TOKEN_SHA`|(build-time)|SHA-256 of the token, baked into image                |

⸻

## 8  What gets configured

The installer writes these configs on the host:

### Nginx (`/etc/nginx/sites-available/thatdam`)

- Serves Next.js static files from `/var/www/html`
- Proxies `/api/` to port 8080 for backend services
- WebSocket support at `/ws/` endpoint
- Proper caching headers for `/_next/` assets

### Avahi mDNS (`/etc/avahi/services/thatdam.service`)

- Advertises `thatdamtoolbox.local` on the network
- Exposes HTTP (port 80) and custom service (port 8080)

### WiFi Hotspot (`/etc/hostapd/hostapd.conf`)

- SSID: `ThatDAMToolbox`
- Password: `thatdam123`
- Channel 6, WPA2 security

### DHCP Server (`/etc/dnsmasq.d/thatdam.conf`)

- IP range: `192.168.42.10-50`
- Gateway: `192.168.42.1`
- Local domain resolution

### Service launcher (`/usr/local/bin/start-services.sh`)

- Configures wlan0 interface
- Starts all services in correct order
- Tails nginx logs for monitoring

⸻

## 9  Regenerating / rotating the token

1. `openssl rand -hex 32 > secrets/dam_token.txt`
1. Re-export `EPHEMERAL_TOKEN_SHA` and rebuild the image
1. Update the secret in your orchestrator (compose/k8s/ansible)
1. Re-run the installer container (it will recognize the change and overwrite the previous token)

⸻

## 10  Un-install / reset

On the host:

```bash
sudo systemctl disable --now nginx avahi-daemon hostapd dnsmasq
sudo rm -rf /etc/thatdamtoolbox/
sudo rm -f /etc/nginx/sites-available/thatdam
sudo rm -f /etc/nginx/sites-enabled/thatdam
sudo rm -f /etc/avahi/services/thatdam.service
sudo rm -f /etc/hostapd/hostapd.conf
sudo rm -f /etc/dnsmasq.d/thatdam.conf
sudo rm -f /usr/local/bin/start-services.sh
```

⸻

## Done!

Your Pi now broadcasts a hotspot and serves the That DAM Toolbox UI at:

- **http://thatdamtoolbox.local** (LAN or hotspot clients)
- **http://192.168.42.1** (default hotspot gateway)

Start all services with: `/usr/local/bin/start-services.sh`

---

# Makefile To Run

This Makefile provides a comprehensive interface for the hotspot-installer from within its directory while properly referencing the secrets from `../../secrets/`.

Key features:

**Path Management:**

- Uses `ROOT_DIR := ../..` to reference the project root
- Token file at `$(ROOT_DIR)/secrets/dam_token.txt`
- All orchestration files referenced properly

**Core Workflow:**

```bash
make token      # Generate new token
make build      # Build image with token hash
make dry-run    # Interactive preview
make apply      # Apply to host
```

**Orchestration Options:**

```bash
make compose-up     # Docker Compose
make ansible        # Ansible playbook
make k8s-deploy     # Kubernetes
```

**Development Helpers:**

```bash
make logs           # Follow service logs
make status         # Check service status  
make start/stop     # Control services
make verify-token   # Validate token format
```

**Cleanup:**

```bash
make clean          # Remove image and token
make reset-host     # Undo host configuration
```

The Makefile handles:

- Token generation and SHA calculation for builds
- Proper working directory changes for compose/ansible
- Secret mounting and environment variables
- Error checking for missing files
- Clean, colored output with emojis for readability

All commands work from the `docker/hotspot-installer/` directory while correctly referencing the root project structure!​​​​​​​​​​​​​​​​

---

Happy hacking 🚀