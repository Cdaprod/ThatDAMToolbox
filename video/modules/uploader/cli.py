# video/modules/uploader/cli.py
"""
CLI sugar:  video upload clip1.mp4 clip2.mkv --batch MyShoot
sends a multipart POST to your FastAPI uploader.
"""
from __future__ import annotations

import pathlib, sys, requests, mimetypes, logging
from argparse import Namespace
from typing   import List

from video.cli import register

log = logging.getLogger("video.cli.upload")

@register("upload", help="Upload local file(s) via REST API")
def _upload(args: Namespace) -> None:
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

    resp = requests.post("http://localhost:8080/api/v1/upload", data=data, files=files)

    try:
        resp.raise_for_status()
        print(resp.json())
        log.info("✅ Uploaded %d file(s)", len(paths))
    except Exception as e:
        log.error("Upload failed: %s", e)
        sys.exit(1)


def add_parser(sub):
    p = sub.add_parser("upload", help="Upload files through the API")
    p.add_argument("paths", nargs="+", metavar="FILE", help="Video files to send")
    p.add_argument("--batch", help="Optional batch name to group the files")