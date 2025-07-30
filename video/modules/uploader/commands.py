#!/usr/bin/env python3
"""
/video/modules/uploader/commands.py

CLI verb:  video upload  FILE1 [FILE2 …]  [--batch NAME] [--url http://…]
Uploads one or more local files to the FastAPI uploader.
"""
from __future__ import annotations

import json, logging, mimetypes, os, pathlib, sys, time
from argparse import Namespace
from typing   import List

import requests
from video.cli import register

log = logging.getLogger("video.cli.upload")


@register("upload", help="Upload local file(s) via REST API")
def cli_upload(args: Namespace) -> None:
    """
    Usage examples
    --------------
        video upload clip.mp4               # default localhost
        video upload a.mp4 b.mov --batch MyShoot --url http://api:8080
    """
    paths: List[pathlib.Path] = [pathlib.Path(p) for p in args.paths]
    for p in paths:
        if not p.is_file():
            sys.exit(f"❌ {p} is not a file")

    files = [
        (
            "files",
            (
                p.name,
                open(p, "rb"),
                mimetypes.guess_type(p.name)[0] or "application/octet-stream",
            ),
        )
        for p in paths
    ]
    data = {"batch": args.batch} if args.batch else {}

    base_url = args.url or os.getenv("VIDEO_API_URL", "http://localhost:8080")
    url      = f"{base_url.rstrip('/')}/api/v1/upload"

    ts0  = time.perf_counter()
    resp = requests.post(url, data=data, files=files)

    try:
        resp.raise_for_status()
        print(json.dumps(resp.json(), indent=2))
        log.info(
            "✅ Uploaded %d file(s) in %.1f s → %s",
            len(paths), time.perf_counter() - ts0, base_url,
        )
    except Exception as exc:
        log.error("Upload failed: %s", exc)
        sys.exit(1)


def add_parser(sub) -> None:
    p = sub.add_parser("upload", help="Upload files through the API")
    p.add_argument("paths", nargs="+", metavar="FILE", help="Files to send")
    p.add_argument("--batch", help="Optional batch name to group files")
    p.add_argument(
        "--url",
        help="Override API base URL (else $VIDEO_API_URL or http://localhost:8080)",
    )