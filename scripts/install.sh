#!/usr/bin/env bash
# install.sh - Install ThatDAMToolbox minimal services on Raspberry Pi devices.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Cdaprod/ThatDAMToolbox/main/scripts/install.sh | sudo bash
#
# Example (local file):
#   sudo bash scripts/install.sh
#
# The script detects the current architecture, downloads the latest release
# binaries, and installs them to /usr/local/bin.
set -euo pipefail

REPO="Cdaprod/ThatDAMToolbox"
BIN_DIR="/usr/local/bin"
ARCH="$(uname -m)"

case "$ARCH" in
  aarch64)
    GOARCH="arm64"
    ;;
  armv7l|armv6l)
    GOARCH="arm"
    ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

URL="https://github.com/${REPO}/releases/latest/download/host-binaries-linux-${GOARCH}.tar.gz"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "Downloading binaries for $GOARCH..."
if ! curl -fsSL "$URL" -o "$TMP/binaries.tar.gz"; then
  echo "Failed to download $URL" >&2
  exit 1
fi

if ! tar -xzf "$TMP/binaries.tar.gz" -C "$TMP"; then
  echo "Failed to extract binaries" >&2
  exit 1
fi

install -m 0755 "$TMP"/* "$BIN_DIR/"
echo "Installed binaries to $BIN_DIR"
