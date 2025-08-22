"""Ensure PostgreSQL collation refresh job is present.

Example:
    pytest script_tests/test_postgres_collation_refresh.py -q
"""
from pathlib import Path
import yaml

def test_collation_refresh_service_present():
    compose = yaml.safe_load(Path("docker/compose/docker-compose.postgres.yaml").read_text())
    services = compose.get("services", {})
    assert "postgres-collation-refresh" in services, "collation refresh service missing"
    cmd = services["postgres-collation-refresh"].get("command", [])
    assert "ALTER DATABASE weaviate REFRESH COLLATION VERSION;" in cmd
