"""Verify Weaviate compose config avoids self-join attempts.

Run with:
    PYTHONPATH=. pytest docker/weaviate/test_compose_config.py
"""

from pathlib import Path

import yaml


def test_cluster_join_disabled():
    compose_path = Path(__file__).resolve().parents[1] / "compose" / "docker-compose.weaviate.yaml"
    with open(compose_path) as f:
        doc = yaml.safe_load(f)

    env = doc["services"]["weaviate"]["environment"]
    assert "CLUSTER_JOIN" in env
    assert env["CLUSTER_JOIN"] == ""
