"""Verify new deployment compose files exist."""
from pathlib import Path

def test_compose_files_exist():
    for fname in [
        "docker/compose/docker-compose.server.yaml",
        "docker/compose/docker-compose.capture.yaml",
    ]:
        assert Path(fname).is_file(), f"{fname} missing"
