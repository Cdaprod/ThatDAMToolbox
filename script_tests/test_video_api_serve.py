from pathlib import Path

SCRIPT = Path("host/services/video-api/serve")

def test_shebang_is_bash():
    first_line = SCRIPT.read_text().splitlines()[0]
    assert first_line == "#!/usr/bin/env bash"
