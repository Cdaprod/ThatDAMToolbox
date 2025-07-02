#!/usr/bin/env python3
"""
Universal entry-point for the *video* package.

• Reads JSON from **stdin** (preferred for Shortcuts "Run Script" action)
  OR falls back to command-line flags.

Example JSON for Shortcuts  ▸
{
  "action": "sync_album",
  "root":   "/Volumes/Media/B/Video",
  "album":  "My Album",
  "category": "edit",
  "copy":   true
}

Supported actions  ▸
  scan            – index a directory tree
  sync_album      – copy Photos album to SMB + index
  stats           – return DB statistics
  recent          – return N most-recent files
"""

from __future__ import annotations
import sys, json, argparse, logging, os
from pathlib import Path
from datetime import datetime
from typing import Any, Dict

# ─── Make direct "python __main__.py" lookups behave like "python -m video" ───
if __package__ is None:
    # 1) video_pkg   = /.../Documents/video
    # 2) project_dir = parent of video_pkg
    video_pkg   = os.path.dirname(__file__)
    project_dir = os.path.dirname(video_pkg)

    # 3) ensure project_dir is on sys.path so that `import video` works
    sys.path.insert(0, project_dir)

    # 4) tell Python "we are the video package"
    __package__ = os.path.basename(video_pkg)

# ──────────────────────────────────────────────────────────────────────────────

from . import config
from . import MediaIndexer   # now works whether you run via -m or via script path
log = logging.getLogger("video.cli")
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

# ───────────────────────── helpers ───────────────────────── #
def _resolve_path(cli_val, env_key, cfg_val):
    if cli_val:
        return Path(cli_val)
    env_val = os.getenv(env_key, "")
    if env_val:
        return Path(env_val)
    if cfg_val:
        return cfg_val
    return None

def _json_from_stdin() -> Dict[str, Any] | None:
    raw = sys.stdin.read()
    if raw.strip() == "":
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        log.error("Invalid JSON on stdin: %s", exc)
        sys.exit(1)

def _cli_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="python3 -m video",
                                description="Media indexer frontend")
    sub = p.add_subparsers(dest="action")

    # scan
    scan = sub.add_parser("scan", help="index a directory")
    scan.add_argument("--root", type=Path, help="directory to scan")
    scan.add_argument("--workers", type=int, default=4)

    # sync_album
    sync = sub.add_parser("sync_album", help="sync an iOS Photos album")
    sync.add_argument("--root", type=Path, required=True, help="SMB root path")
    sync.add_argument("--album", help="leaf album name (omit for picker)")
    sync.add_argument("--category", default="edit", choices=["edit", "digital"])
    sync.add_argument("--copy", action="store_true", default=True,
                      help="actually copy media (default true)")

    # stats
    sub.add_parser("stats", help="database statistics")

    # recent
    recent = sub.add_parser("recent", help="recently indexed files")
    recent.add_argument("-n", "--limit", type=int, default=10)

    dump = sub.add_parser("dump", help="dump all file metadata")
    dump.add_argument(
      "--format", choices=["json","csv"], default="json",
      help="output as JSON (default) or CSV"
    )
    
    back = sub.add_parser("backup", help="copy indexed media to backup root")
    back.add_argument("--backup_root", type=Path, help="destination root dir")
    
    return p

# ───────────────────────── main dispatcher ───────────────────────── #

def main() -> None:
    idx = MediaIndexer()          # default paths fine for iOS
    
    in_json = _json_from_stdin()
    if in_json:
        action = in_json.get("action", "scan")
        args = in_json
    else:
        ns = _cli_parser().parse_args()
        action = ns.action or "scan"
        args = vars(ns)           # Namespace → dict

    # ---- dispatch ----------------------------- #
    if action == "scan":
        res = idx.scan(root_path=args.get("root"), workers=args.get("workers", 4))

    elif action == "sync_album":
        payload = {
            "root": args["root"],
            "album": args.get("album"),
            "category": args.get("category", "edit"),
            "copy": args.get("copy", True),
        }
        res = idx.sync.sync_album_from_args(payload)   # use your existing method

    elif action == "stats":
        res = idx.get_stats()

    elif action == "recent":
        res = [dict(r) for r in idx.get_recent(limit=args.get("limit", 10))]

    elif action == "dump":
        data = idx.get_all()
        fmt  = args.get("format", "json")
        if fmt == "json":
            print(json.dumps(data, indent=2, ensure_ascii=False))
        else:
            # simple CSV writer
            import csv, sys
            writer = csv.DictWriter(sys.stdout, fieldnames=list(data[0].keys()))
            writer.writeheader()
            writer.writerows(data)
    
    elif action == "backup":
        bk_root = (
            _resolve_path(args.get("backup_root"),
                          "VIDEO_BACKUP",
                          config.get_path("paths", "backup"))
            or Path(args.get("root") or ".")   # fall-back to scan root
        )
        if not bk_root:
            log.error("Backup root not provided.")
            sys.exit(2)
        res = idx.backup(bk_root)
    
    else:
        log.error("Unknown action %r", action)
        sys.exit(2)

    # ---- always emit JSON to stdout ------------ #
    print(json.dumps(res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()