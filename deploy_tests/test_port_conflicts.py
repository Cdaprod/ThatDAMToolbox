"""Detect duplicate host ports in default compose stack.

Example:
    pytest deploy_tests/test_port_conflicts.py::test_no_host_port_conflicts
"""

import re
import subprocess

import pytest


def test_no_host_port_conflicts():
    """Ensure docker-compose exposes unique host ports."""
    cmd = ["docker", "compose", "config"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError:
        pytest.skip("docker not installed")
    assert proc.returncode == 0, proc.stderr

    ports = {}
    for line in proc.stdout.splitlines():
        match = re.search(r"published:\s*(\d+)", line)
        if match:
            port = int(match.group(1))
            assert port not in ports, f"duplicate host port {port}"
            ports[port] = True
