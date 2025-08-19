import os
import pathlib
import subprocess

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "install-runner.sh"


def run_script(args, env):
    return subprocess.run(["bash", str(SCRIPT), *args], capture_output=True, text=True, env=env)


def setup_env(tmp_path):
    stub = tmp_path / "bin"
    stub.mkdir()
    # stub runner binary
    (stub / "runner").write_text("#!/bin/sh\nexit 0\n")
    # stub systemctl
    (stub / "systemctl").write_text("#!/bin/sh\nexit 0\n")
    for f in stub.iterdir():
        f.chmod(0o755)
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{stub}:{env['PATH']}",
            "RUNNER_ENV_FILE": str(tmp_path / "runner.env"),
            "SYSTEMD_UNIT_FILE": str(tmp_path / "thatdam-runner.service"),
        }
    )
    return env


def test_requires_supervisor(tmp_path):
    env = setup_env(tmp_path)
    result = run_script([], env)
    assert result.returncode != 0
    assert "--supervisor" in result.stderr


def test_writes_env_file(tmp_path):
    env = setup_env(tmp_path)
    args = [
        "--supervisor",
        "http://sup",
        "--executor",
        "nerdctl",
        "--claim",
        "tok",
        "--role-hint",
        "edge",
        "--labels",
        "gpu",
    ]
    result = run_script(args, env)
    assert result.returncode == 0
    data = (tmp_path / "runner.env").read_text()
    assert "SUPERVISOR_URL=http://sup" in data
    assert "RUNNER_EXECUTOR=nerdctl" in data
    assert "RUNNER_CLAIM_TOKEN=tok" in data
    assert "RUNNER_ROLE_HINT=edge" in data
    assert "RUNNER_LABELS=gpu" in data

