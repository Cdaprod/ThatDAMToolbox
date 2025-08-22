"""Tests for docker/video-api/entrypoint.sh directory handling.

Example:
    pytest script_tests/test_video_api_entrypoint.py -q
"""

import os
import pathlib
import subprocess
import pwd

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "docker" / "video-api" / "entrypoint.sh"


def test_directory_creation_permission_denied(tmp_path):
    ro_root = tmp_path / "ro"
    ro_root.mkdir()
    ro_root.chmod(0o555)

    env = os.environ.copy()
    env.update(
        {
            "VIDEO_DATA_DIR": str(ro_root),
            "VIDEO_MEDIA_ROOT": str(ro_root / "media"),
            "MODULES_ROOT": str(ro_root / "modules"),
        }
    )

    nobody = pwd.getpwnam("nobody")

    def demote():
        os.setgid(nobody.pw_gid)
        os.setuid(nobody.pw_uid)

    result = subprocess.run(
        ["bash", str(SCRIPT), "echo", "ok"],
        env=env,
        text=True,
        capture_output=True,
        preexec_fn=demote,
    )

    assert result.returncode == 0
    assert "Could not create directory" in result.stderr
