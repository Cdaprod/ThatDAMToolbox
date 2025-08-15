import json
import os
import pathlib
import subprocess

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "register-runner.sh"


def run_script(env):
    return subprocess.run(["bash", str(SCRIPT)], capture_output=True, text=True, env=env)


def test_requires_env_vars():
    env = os.environ.copy()
    for k in ("GH_OWNER", "GH_REPO", "GH_PAT", "RUNNER_ROLE", "GH_SCOPE"):
        env.pop(k, None)
    result = run_script(env)
    assert result.returncode != 0
    assert "RUNNER_ROLE" in result.stderr or "GH_OWNER" in result.stderr


def test_dry_run(tmp_path):
    env = os.environ.copy()
    env.update({
        "GH_SCOPE": "repo",
        "GH_OWNER": "foo",
        "GH_REPO": "bar",
        "GH_PAT": "baz",
        "RUNNER_ROLE": "server",
        "DRY_RUN": "1",
        "HOME": str(tmp_path),
    })
    result = run_script(env)
    assert result.returncode == 0
    assert "DRY RUN" in result.stderr


def test_prefers_auth_bridge_token(tmp_path):
    env = os.environ.copy()
    env.update({
        "GH_SCOPE": "repo",
        "GH_OWNER": "o",
        "GH_REPO": "r",
        "RUNNER_ROLE": "worker",
        "AUTH_BRIDGE_URL": "http://localhost:9999",
        "DRY_RUN": "1",
        "HOME": str(tmp_path),
    })
    result = run_script(env)
    assert result.returncode == 0
    assert "DRY RUN" in result.stderr


def test_idempotent_reconfigure(tmp_path):
    home = tmp_path
    runner = home / "actions-runner"
    runner.mkdir()
    (runner / ".runner").write_text(
        '{"Name":"test","Url":"https://github.com/o/r","Labels":\n["self-hosted","linux","role-server"]}'
    )
    env = os.environ.copy()
    env.update({
        "GH_SCOPE": "repo",
        "GH_OWNER": "o",
        "GH_REPO": "r",
        "GH_PAT": "tok",
        "RUNNER_ROLE": "server",
        "RUNNER_NAME": "test",
        "DRY_RUN": "1",
        "HOME": str(home),
    })
    result = run_script(env)
    assert result.returncode == 0
    assert "DRY RUN: ./config.sh --unattended" in result.stderr

