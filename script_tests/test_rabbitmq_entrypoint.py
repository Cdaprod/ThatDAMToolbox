import os
import pathlib
import subprocess

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "docker" / "rabbitmq" / "entrypoint.sh"


def test_enables_feature_flag(tmp_path):
    log = tmp_path / "log"
    # stub rabbitmqctl to record invocation
    ctl = tmp_path / "rabbitmqctl"
    ctl.write_text("#!/usr/bin/env bash\n" f"echo rabbitmqctl >> {log}\n")
    ctl.chmod(0o755)
    # stub docker-entrypoint.sh to avoid launching rabbitmq
    de = tmp_path / "docker-entrypoint.sh"
    de.write_text("#!/usr/bin/env bash\n" f"echo entrypoint >> {log}\n")
    de.chmod(0o755)

    env = os.environ.copy()
    env["PATH"] = f"{tmp_path}:{env['PATH']}"

    result = subprocess.run(["bash", str(SCRIPT)], env=env, text=True, capture_output=True)
    assert result.returncode == 0
    assert log.read_text().splitlines() == ["rabbitmqctl", "entrypoint"]
