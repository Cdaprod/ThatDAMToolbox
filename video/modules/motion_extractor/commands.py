# /video/modules/motion_extractor/commands.py

from pathlib import Path
from argparse import ArgumentParser, Namespace
from .motion_extractor import MotionExtractor
from video.cli import register          # decorator from core

@register("motion_extract", help="extract motion frames from a video")
def cli_motion_extract(args: Namespace):
    """
    Usage example:
        python -m video motion_extract --video in.mp4 --out frames --fps 2
    """
    me = MotionExtractor(
        video_path=args.video,
        output_dir=args.out,
        motion_threshold=args.threshold,
        fps_sampling=args.fps
    )
    stats = me.extract_with_stats()
    print(stats)

# ---- let main CLI know what args we need --------------------
def add_parser(sub):                               # called by core (optional)
    p = sub.add_parser("motion_extract", help="motion-frame extractor")
    p.add_argument("--video", required=True, type=Path)
    p.add_argument("--out", default="motion_frames", type=Path)
    p.add_argument("--threshold", type=int, default=3000)
    p.add_argument("--fps", type=int, default=1)