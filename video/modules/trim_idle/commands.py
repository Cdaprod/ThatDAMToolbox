#!/usr/bin/env python3
"""
CLI bindings for the trim-idle plug-in (pure-stdlib argparse).

Adds the verb:
    video trim_idle --video in.mp4 --out out.mp4 [--method ffmpeg]

The real work is done by :class:`TrimIdleProcessor` in *trimmer.py*.
"""

from pathlib import Path
from argparse import Namespace

from video.cli import register             # ← same decorator you already use
from .trimmer import TrimIdleProcessor


# ─── command entry-point ------------------------------------------------------
@register("trim_idle", help="remove idle / frozen segments from a video")
def cli_trim_idle(args: Namespace) -> None:
    """
    Example:
        python -m video trim_idle --video screen.mp4 --out tight.mp4
    """
    trimmer = TrimIdleProcessor(
        src=args.video,
        dst=args.out,
        method=args.method,
        noise=args.noise,
        freeze_dur=args.dur,
        pix_thresh=args.pix_thresh,
    )
    final = trimmer.run()
    print(f"✅  Written: {final}")


# ─── argparse plumbing (called by video.cli.build_parser) ---------------------
def add_parser(sub) -> None:
    """
    Extend the root `video` parser.

    `sub` is the result of `p.add_subparsers()` inside *video/cli.py*.
    """
    p = sub.add_parser("trim_idle", help="trim idle / still frames")
    p.add_argument("--video", required=True, type=Path, help="input video")
    p.add_argument("--out",   default=Path("trimmed.mp4"), type=Path,
                   help="output file (default: trimmed.mp4)")
    p.add_argument("--method", choices=["ffmpeg", "opencv"],
                   default="ffmpeg", help="backend to use (default: ffmpeg)")
    p.add_argument("--noise", type=float, default=0.003,
                   help="freezedetect noise floor (ffmpeg)")
    p.add_argument("--dur",   type=float, default=0.10,
                   help="minimum idle duration in seconds")
    p.add_argument("--pix_thresh", type=float, default=2.0,
                   help="MSE threshold for OpenCV backend")