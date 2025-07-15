from argparse import Namespace
from .ffmpeg_console import run_ffmpeg_console
from video.cli import register

@register("ffmpeg_cmd", help="Run arbitrary ffmpeg command on a video file")
def cli_ffmpeg_cmd(args: Namespace):
    """
    Usage:
        python -m video ffmpeg_cmd --video input.mov --cmd "ffmpeg ..."
    """
    result = run_ffmpeg_console(
        video_path=args.video,
        cmd=args.cmd,
        output_path=args.output,
        capture_output=True
    )
    print("Command:", result["cmd"])
    print("Return code:", result["returncode"])
    print("STDOUT:", result["stdout"])
    print("STDERR:", result["stderr"])
    print("Output file:", result["output_file"])

def add_parser(sub):
    p = sub.add_parser("ffmpeg_cmd", help="Run ffmpeg command on file")
    p.add_argument("--video", required=True)
    p.add_argument("--cmd", required=True, help="ffmpeg command (use {{input}} and {{output}})")
    p.add_argument("--output", help="output file name (optional)")