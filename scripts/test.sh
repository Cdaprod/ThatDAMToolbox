#!/usr/bin/env bash
# test.sh - Run Go and Python tests for That DAM Toolbox
#
# Usage:
#   ./scripts/test.sh [pytest-args]
#
# Example:
#   ./scripts/test.sh -q
#
# Runs Go unit tests for key modules and Python tests, forwarding any
# additional arguments to pytest.
set -euo pipefail

echo "Running Go tests..."
(cd host/services/shared && go test ./...)
(cd host/services/api-gateway && go test ./...)

echo "Running Python tests..."
python3 -m pytest tests/ -v "$@"
