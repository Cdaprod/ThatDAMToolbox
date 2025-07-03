#!/usr/bin/env python3
"""Command–line front-end for the *video* package (pure stdlib)."""

from __future__ import annotations
import sys, json, argparse, logging, io, csv, os
from pathlib import Path
from typing import Any, Dict, List

from . import MediaIndexer, config
from .commands import (
    ScanParams, SyncAlbumParams, BackupParams, RecentParams, DumpParams,
    SearchParams, CleanParams,
    ScanResult, SyncResult, BackupResult,
    serialize_result
)

log = logging.getLogger("video.cli")
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

# ─── parser builder -----------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="video",
                                description="Media bridge / DAM toolbox")
    sub = p.add_subparsers(dest="action")

    scan = sub.add_parser("scan", help="index a directory")
    scan.add_argument("--root", type=Path)
    scan.add_argument("--workers", type=int, default=4)

    sync = sub.add_parser("sync_album", help="sync an iOS Photos album")
    sync.add_argument("--root", type=Path, required=True)
    sync.add_argument("--album")
    sync.add_argument("--category", default="edit", choices=["edit", "digital"])
    sync.add_argument("--copy", action="store_true", default=True)

    sub.add_parser("stats", help="database statistics")

    recent = sub.add_parser("recent", help="recently indexed files")
    recent.add_argument("-n", "--limit", type=int, default=10)

    dump = sub.add_parser("dump", help="dump DB rows")
    dump.add_argument("--format", choices=["json", "csv"], default="json")

    back = sub.add_parser("backup", help="copy to backup root")
    back.add_argument("--backup_root", type=Path, required=True)

    search = sub.add_parser("search", help="FTS search")
    search.add_argument("query")
    search.add_argument("--mime")
    search.add_argument("--limit", type=int, default=50)

    clean = sub.add_parser("clean", help="wipe DB (danger!)")
    clean.add_argument("--confirm", action="store_true")

    return p

# ─── helpers ------------------------------------------------------------------
def _json_from_stdin() -> Dict[str, Any] | None:
    if sys.stdin.isatty():
        return None
    raw = sys.stdin.read().strip()
    return json.loads(raw) if raw else None

def _resolve_path(cli_val, env_key, cfg_val) -> Path | None:
    if cli_val: return Path(cli_val)
    if os.getenv(env_key): return Path(os.getenv(env_key))
    return cfg_val

# ─── dispatcher ---------------------------------------------------------------
def dispatch(idx: MediaIndexer, step: Dict[str, Any]) -> Any:
    action = step.get("action", "scan")

    if action == "scan":
        p = ScanParams(
            root=_resolve_path(step.get("root"), "VIDEO_ROOT", config.get_path("paths", "root")),
            workers=step.get("workers", 4))
        return ScanResult(**idx.scan(p.root, p.workers))

    if action == "sync_album":
        p = SyncAlbumParams(
            root=_resolve_path(step.get("root"), "VIDEO_ROOT", config.get_path("paths", "root")),
            album=step.get("album"),
            category=step.get("category", "edit"),
            copy=step.get("copy", True))
        return SyncResult(**idx.sync.sync_album_from_args(p.to_dict()))

    if action == "stats":
        return idx.get_stats()

    if action == "recent":
        p = RecentParams(limit=step.get("limit", 10))
        return idx.get_recent(p.limit)

    if action == "dump":
        p = DumpParams(fmt=step.get("format", "json"))
        rows = idx.get_all()
        if p.fmt == "csv":
            buf = io.StringIO()
            if rows:
                writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
                writer.writeheader(); writer.writerows(rows)
            return buf.getvalue()
        return rows

    if action == "backup":
        p = BackupParams(backup_root=_resolve_path(step["backup_root"], "VIDEO_BACKUP", None))
        return BackupResult(**idx.backup(p.backup_root))

    if action == "search":
        p = SearchParams(query=step["query"], mime=step.get("mime"), limit=step.get("limit", 50))
        return idx.db.search_files(p.query, p.mime, p.limit)

    if action == "clean":
        p = CleanParams(confirm=step.get("confirm", False))
        if not p.confirm:
            return {"error": "clean requires --confirm"}
        removed = idx.db.clean_all()
        return {"removed": removed}

    return {"error": f"unknown action {action}"}

# ─── top-level ---------------------------------------------------------------
def run_cli(argv: List[str] | None = None) -> None:
    idx = MediaIndexer()

    stdin_obj = _json_from_stdin()
    if stdin_obj is not None:
        steps = stdin_obj["workflow"] if "workflow" in stdin_obj else [stdin_obj]
    else:
        ns = build_parser().parse_args(argv)
        steps = [vars(ns)]

    out: list[Any] = [dispatch(idx, s) for s in steps]
    if len(out) == 1:
        print(json.dumps(serialize_result(out[0]), indent=2, ensure_ascii=False, default=str))
    else:
        print(json.dumps([serialize_result(r) for r in out], indent=2, ensure_ascii=False, default=str))

# allow `python -m video.cli`
if __name__ == "__main__":
    run_cli()