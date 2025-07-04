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

    # scan
    scan = sub.add_parser("scan", help="index a directory")
    scan.add_argument("--root", type=Path)
    scan.add_argument("--workers", type=int, default=4)

    # sync
    sync = sub.add_parser("sync_album", help="sync an iOS Photos album")
    sync.add_argument("--root", type=Path, required=True)
    sync.add_argument("--album")
    sync.add_argument("--category", default="edit", choices=["edit", "digital"])
    sync.add_argument("--copy", action="store_true", default=True)

    # stats
    sub.add_parser("stats", help="database statistics")

    # resent
    recent = sub.add_parser("recent", help="recently indexed files")
    recent.add_argument("-n", "--limit", type=int, default=10)

    # dump
    dump = sub.add_parser("dump", help="dump DB rows")
    dump.add_argument("--format", choices=["json", "csv"], default="json")

    # backup
    back = sub.add_parser("backup", help="copy to backup root")
    back.add_argument("--backup_root", type=Path, required=True)

    # search
    search = sub.add_parser("search", help="FTS search")
    search.add_argument("query")
    search.add_argument("--mime")
    search.add_argument("--limit", type=int, default=50)

    clean = sub.add_parser("clean", help="wipe DB (danger!)")
    clean.add_argument("--confirm", action="store_true")

    # paths 
    paths = sub.add_parser("paths", help="manage network paths")
    paths_sub = paths.add_subparsers(dest="cmd")

    paths_sub.add_parser("list", help="show network paths")

    add = paths_sub.add_parser("add", help="add a new network path")
    add.add_argument("path", type=Path, help="directory or glob to add")

    rm = paths_sub.add_parser("remove", help="remove a path by index")
    rm.add_argument("index", type=int, help="index from list")
    
    batches = sub.add_parser("batches", help="work with batches")
    batches_sub = batches.add_subparsers(dest="cmd")

    # list all batches
    batches_sub.add_parser("list", help="list all batches")

    # show media in a specific batch
    show = batches_sub.add_parser("show", help="show media files in a batch")
    show.add_argument("batch_name", help="name of the batch to display")

    # add a new Photos-album batch (sync + index)
    batch_add = batches_sub.add_parser(
        "add",
        help="sync & index a Photos album as a new batch"
    )
    batch_add.add_argument(
        "--root", "-r",
        type=Path,
        help="SMB root path (defaults to VIDEO_ROOT or config [paths] root)"
    )
    batch_add.add_argument(
        "--album", "-a",
        required=True,
        help="Exact leaf name of the iOS Photos album to sync"
    )
    batch_add.add_argument(
        "--category", "-c",
        default="edit",
        choices=["edit","digital"],
        help="Album category (edit|digital)"
    )
    
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
        rows = idx.get_recent(p.limit)
        return [dict(row) for row in rows]  # Convert each row to a dict

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

    elif action == "paths":
        cmd = step.get("cmd")
        if cmd == "list":
            return [str(p) for p in config.get_network_paths()]
        elif cmd == "add":
            path = step["path"]
            ok = config.add_network_path(str(path))
            return {"added": str(path)} if ok else {"error": "duplicate"}
        elif cmd == "remove":
            idx = step["index"]
            removed = config.remove_network_path(idx)
            return {"removed": str(removed)}
    
    if action == "batches":
        cmd = step.get("cmd")
        if cmd == "list":
            return idx.db.get_stats()["by_batch"]

        if cmd == "show":
            batch_name = step.get("batch_name")
            if not batch_name:
                return {"error": "batch_name is required"}
            files = idx.db.list_by_batch(batch_name)
            return [dict(file) for file in files]
        
        if cmd == "add":
            # 1) sync album into <root>/_INCOMING/<album>
            root = _resolve_path(
                step.get("root"),
                "VIDEO_ROOT",
                config.get_path("paths", "root")
            )
            sync_args = {
                "root": str(root),
                "album": step["album"],
                "category": step.get("category", "edit")
            }
            res = idx.sync.sync_album_from_args(sync_args)

            # 2) index that folder
            dest = Path(res.get("dest", ""))
            scan_res = {}
            if dest.exists():
                scan_res = idx.scanner.bulk_scan(dest, workers=step.get("workers", 0))

            return {
                "batch":  res.get("album"),
                "synced": res.get("synced"),
                "skipped": res.get("skipped"),
                "scan":   scan_res
            }    
            
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