"""Tests for nginx snippet creation.

Run with:
    pytest tests/test_nginx_entrypoint_snippets.py
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import textwrap


SNIPPETS = {
    "proxy_defaults.conf": textwrap.dedent(
        """\
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $http_connection;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        """
    ),
    "proxy_ws.conf": textwrap.dedent(
        """\
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        """
    ),
    "proxy_nobuf.conf": textwrap.dedent(
        """\
        proxy_pass_request_headers on;
        proxy_buffering off;
        proxy_cache off;
        """
    ),
}


def _run_block(target: Path, name: str, snippet: str) -> None:
    """Execute the conditional write block for a given snippet file."""

    block = (
        f"[ -f {target}/{name} ] || cat > {target}/{name} <<'EOF'\n"
        f"{snippet}EOF\n"
    )
    subprocess.run(["bash", "-c", block], check=True)


def test_snippet_creation_is_idempotent(tmp_path: Path) -> None:
    """Snippet blocks create files once and do not overwrite custom edits."""

    nginx_dir = tmp_path / "etc" / "nginx"
    nginx_dir.mkdir(parents=True)

    for name, content in SNIPPETS.items():
        path = nginx_dir / name

        _run_block(nginx_dir, name, content)
        assert path.read_text() == content

        path.write_text("custom\n")
        _run_block(nginx_dir, name, content)
        assert path.read_text() == "custom\n"

