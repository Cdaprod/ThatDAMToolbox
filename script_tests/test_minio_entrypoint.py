"""Test the MinIO entrypoint script.

Usage:
    pytest script_tests/test_minio_entrypoint.py

Example:
    MINIO_ROOT_USER=minio MINIO_ROOT_PASSWORD=minio123 \
    MINIO_BUCKET_MEDIA=media MINIO_MEDIA_PUBLIC=1 \
    MINIO_SVC_ACCESS_KEY=svc MINIO_SVC_SECRET_KEY=secret \
    bash docker/minio/entrypoint.sh
"""

import os
import pathlib
import subprocess

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "docker" / "minio" / "entrypoint.sh"


def test_creates_bucket_and_policy(tmp_path):
    log = tmp_path / "log"

    minio = tmp_path / "minio"
    minio.write_text(
        f"#!/usr/bin/env bash\n" f"echo minio \"$@\" >> '{log}'\n" "sleep 0.1\n"
    )
    minio.chmod(0o755)

    mc = tmp_path / "mc"
    mc.write_text(
        (
            f"#!/usr/bin/env bash\n"
            f"echo mc \"$@\" >> '{log}'\n"
            "if [[ \"$1\" == \"ls\" ]]; then exit 1; fi\n"
            "if [[ \"$1\" == \"admin\" && \"$2\" == \"user\" && \"$3\" == \"svcacct\" && \"$4\" == \"info\" ]]; then exit 1; fi\n"
            "exit 0\n"
        )
    )
    mc.chmod(0o755)

    wget = tmp_path / "wget"
    wget.write_text(f"#!/usr/bin/env bash\n" f"echo wget \"$@\" >> '{log}'\n" "exit 0\n")
    wget.chmod(0o755)

    env = os.environ.copy()
    env["PATH"] = f"{tmp_path}:{env['PATH']}"
    env.update(
        {
            "MINIO_ROOT_USER": "minio",
            "MINIO_ROOT_PASSWORD": "minio123",
            "MINIO_BUCKET_MEDIA": "media",
            "MINIO_MEDIA_PUBLIC": "1",
            "MINIO_SVC_ACCESS_KEY": "svcaccess",
            "MINIO_SVC_SECRET_KEY": "svcsecret",
        }
    )

    result = subprocess.run(["bash", str(SCRIPT)], env=env, text=True, capture_output=True)
    assert result.returncode == 0

    lines = log.read_text().splitlines()
    assert "mc mb local/media" in lines
    assert "mc anonymous set download local/media" in lines
    assert (
        "mc admin user svcacct add local minio --access-key svcaccess --secret-key svcsecret" in lines
    )

