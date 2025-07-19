# /video/modules/ffmpeg_console/ffmpeg_console.py

import subprocess
from pathlib import Path
from typing import Optional

def run_ffmpeg_console(
    video_path: str,
    cmd: str,
    output_path: Optional[str] = None,
    capture_output: bool = False
) -> dict:
    """
    Run an ffmpeg command, returning output log and output file.
    """
    # Ensure video exists
    input_path = Path(video_path)
    if not input_path.exists():
        raise FileNotFoundError(f"Video file not found: {video_path}")

    # If needed, set output_path by convention
    if not output_path:
        output_path = str(input_path.with_name(f"{input_path.stem}_processed{input_path.suffix}"))

    # Replace {{input}} and {{output}} if present
    cmd = cmd.replace("{{input}}", str(input_path)).replace("{{output}}", output_path)

    proc = subprocess.run(
        cmd, shell=True,
        capture_output=capture_output, text=True
    )
    return {
        "cmd": cmd,
        "returncode": proc.returncode,
        "stdout": proc.stdout if capture_output else "",
        "stderr": proc.stderr if capture_output else "",
        "output_file": output_path
    }