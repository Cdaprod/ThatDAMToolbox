#!/usr/bin/env python3
"""
Universal entry-point for the *video* package.

• Reads JSON from stdin (preferred for Shortcuts "Run Script" action)
  OR falls back to command-line flags.

Example JSON for Shortcuts ▸
{
  "workflow": [
    { "action": "sync_album",
      "root": "/Volumes/Media/B/Video",
      "album": "My Album",
      "category": "edit",
      "copy": true
    },
    { "action": "scan", "root": "/Volumes/Media/B/Video/_INCOMING" },
    { "action": "backup", "backup_root": "/Volumes/Media/B/Video/_MASTER" },
    { "action": "stats" }
  ]
}

Supported actions ▸
  scan            – index a directory tree  
  sync_album      – copy Photos album to SMB + index  
  stats           – return DB statistics  
  recent          – return N most-recent files  
  dump            – dump all metadata as JSON or CSV  
  backup          – copy indexed media to a backup root  
"""

from __future__ import annotations
import sys, os, json, argparse, logging, csv, io
from pathlib import Path
from typing import Any, Dict

# ─── Allow direct script‐path launches as well as "python -m video" ───
if __package__ is None:
    video_pkg   = os.path.dirname(__file__)
    project_dir = os.path.dirname(video_pkg)
    sys.path.insert(0, project_dir)
    __package__ = os.path.basename(video_pkg)

try:
    # when run as a package (python -m video)
    from . import config, MediaIndexer
except ImportError:
    # when run as a script (python video/__main__.py)
    from video import config, MediaIndexer
    
log = logging.getLogger("video.cli")
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

# ───────────────────────── Helpers ───────────────────────── #

def _resolve_path(cli_val, env_key, cfg_val) -> Path | None:
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
    if not raw.strip():
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        log.error("Invalid JSON on stdin: %s", exc)
        sys.exit(1)

def _normalise_steps(js: Dict[str, Any]) -> list[Dict[str, Any]]:
    """Turn {…} or {"workflow":[…]} into a list of step dicts."""
    if not js:
        return []
    if "workflow" in js and isinstance(js["workflow"], list):
        return js["workflow"]
    return [js]

def _cli_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="python3 -m video",
                                description="Media indexer frontend")
    sub = p.add_subparsers(dest="action")

    scan = sub.add_parser("scan", help="index a directory")
    scan.add_argument("--root",    type=Path, help="directory to scan")
    scan.add_argument("--workers", type=int,  default=4)

    sync = sub.add_parser("sync_album", help="sync an iOS Photos album")
    sync.add_argument("--root",     type=Path, required=True, help="SMB root path")
    sync.add_argument("--album",    help="leaf album name (omit for picker)")
    sync.add_argument("--category", default="edit", choices=["edit","digital"])
    sync.add_argument("--copy",     action="store_true", default=True,
                      help="actually copy media (default true)")

    sub.add_parser("stats", help="database statistics")

    recent = sub.add_parser("recent", help="recently indexed files")
    recent.add_argument("-n","--limit", type=int, default=10)

    dump = sub.add_parser("dump", help="dump all file metadata")
    dump.add_argument("--format", choices=["json","csv"], default="json",
                      help="output as JSON or CSV")

    back = sub.add_parser("backup", help="copy indexed media to backup root")
    back.add_argument("--backup_root", type=Path,
                      help="destination root directory")

    return p

def _args_to_step(ns: argparse.Namespace) -> Dict[str, Any]:
    d = vars(ns)
    if not d.get("action"):
        d["action"] = "scan"
    return d

# ───────────────────────── Main ───────────────────────── #

def main() -> None:
    idx = MediaIndexer()

    in_json = _json_from_stdin()
    if in_json is not None:
        steps = _normalise_steps(in_json)
    else:
        parser = _cli_parser()
        ns = parser.parse_args()
        steps = [_args_to_step(ns)]

    results: list[Any] = []

    for step in steps:
        action = step.get("action", "scan")

        if action == "scan":
            root = _resolve_path(step.get("root"),
                                 "VIDEO_ROOT",
                                 config.get_path("paths", "root"))
            res = idx.scan(root_path=root, workers=step.get("workers", 4))

        elif action == "sync_album":
            root = _resolve_path(step.get("root"),
                                 "VIDEO_ROOT",
                                 config.get_path("paths", "root"))
            payload = {
                "root":     str(root) if root else None,
                "album":    step.get("album"),
                "category": step.get("category", "edit"),
                "copy":     step.get("copy", True),
            }
            res = idx.sync.sync_album_from_args(payload)

        elif action == "stats":
            res = idx.get_stats()

        elif action == "recent":
            res = idx.get_recent(limit=step.get("limit", 10))

        elif action == "dump":
            data = idx.get_all()
            if step.get("format") == "csv":
                buf = io.StringIO()
                writer = csv.DictWriter(buf, fieldnames=list(data[0].keys()))
                writer.writeheader()
                writer.writerows(data)
                res = buf.getvalue()
            else:
                res = data

        elif action == "backup":
            bk = _resolve_path(step.get("backup_root"),
                               "VIDEO_BACKUP",
                               config.get_path("paths", "backup"))
            if not bk:
                log.error("Backup root not provided.")
                sys.exit(2)
            res = idx.backup(bk)

        else:
            res = {"error": f"Unknown action {action!r}"}

        results.append(res)

    # Emit JSON (or raw CSV string) to stdout
    if len(results) > 1:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        single = results[0]
        if isinstance(single, str):
            sys.stdout.write(single)
        else:
            print(json.dumps(single, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()