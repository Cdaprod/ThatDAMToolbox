"""Tests for docker/minio/entrypoint.sh behavior.

Example:
    pytest script_tests/test_minio_entrypoint.py -q
"""

import os
import pathlib
import shutil
import subprocess

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "docker" / "minio" / "entrypoint.sh"


def test_sets_public_cors_and_service_account(tmp_path):
    log = tmp_path / "log"

    mc = tmp_path / "mc"
    mc.write_text(
        "#!/usr/bin/env bash\n"
        f"echo mc \"$@\" >> '{log}'\n"
        "if [ \"$1\" = \"cors\" ] && [ \"$2\" = \"set\" ]; then\n"
        f"  echo cors_json \"$(cat \"$4\")\" >> '{log}'\n"
        "fi\n"
        "if [ \"$1\" = \"ls\" ]; then exit 1; fi\n"
        "if [ \"$1\" = \"admin\" ] && [ \"$2\" = \"user\" ] && [ \"$3\" = \"svcacct\" ] && [ \"$4\" = \"info\" ]; then exit 1; fi\n"
        "exit 0\n"
    )
    mc.chmod(0o755)

    wget = tmp_path / "wget"
    wget.write_text("#!/usr/bin/env bash\nexit 0\n")
    wget.chmod(0o755)

    minio = tmp_path / "minio"
    minio.write_text("#!/usr/bin/env bash\nsleep 0.1\n")
    minio.chmod(0o755)
    sys_minio = pathlib.Path("/usr/bin/minio")
    shutil.copy2(minio, sys_minio)

    env = os.environ.copy()
    env["PATH"] = f"{tmp_path}:{env['PATH']}"
    env.update(
        {
            "MINIO_ROOT_USER": "minio",
            "MINIO_ROOT_PASSWORD": "minio123",
            "MINIO_BUCKET_MEDIA": "media",
            "MINIO_MEDIA_PUBLIC": "true",
            "MINIO_MEDIA_CORS_JSON": '{"AllowedMethods":["GET"],"AllowedOrigins":["*"]}',
            "MINIO_SVC_ACCESS_KEY": "svcaccess",
            "MINIO_SVC_SECRET_KEY": "svcsecret",
        }
    )

    try:
        result = subprocess.run(["bash", str(SCRIPT)], env=env, text=True, capture_output=True)
    finally:
        sys_minio.unlink(missing_ok=True)

    assert result.returncode == 0
    lines = log.read_text().splitlines()
    assert f"mc mb local/{env['MINIO_BUCKET_MEDIA']}" in lines
    assert f"mc anonymous set download local/{env['MINIO_BUCKET_MEDIA']}" in lines
    assert f"cors_json {env['MINIO_MEDIA_CORS_JSON']}" in lines
    assert (
        f"mc admin user svcacct add local {env['MINIO_ROOT_USER']} --access-key {env['MINIO_SVC_ACCESS_KEY']} --secret-key {env['MINIO_SVC_SECRET_KEY']}" in lines
    )

