import os
import pathlib
import subprocess

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "register-runner.sh"


def run_script(env):
    return subprocess.run(["bash", str(SCRIPT)], capture_output=True, text=True, env=env)


def test_requires_env_vars():
    env = os.environ.copy()
    env.pop("GH_OWNER", None)
    env.pop("GH_REPO", None)
    env.pop("GH_PAT", None)
    env.pop("RUNNER_ROLE", None)
    result = run_script(env)
    assert result.returncode != 0
    assert "GH_OWNER" in result.stderr


def test_dry_run(tmp_path):
    env = os.environ.copy()
    env.update(
        {
            "GH_OWNER": "foo",
            "GH_REPO": "bar",
            "GH_PAT": "baz",
            "RUNNER_ROLE": "server",
            "DRY_RUN": "1",
            "HOME": str(tmp_path),
        }
    )
    result = run_script(env)
    assert result.returncode == 0
    assert "DRY RUN" in result.stdout
