# /video/commands.py
#!/usr/bin/env python3
"""All of your command dataclasses and functions for `video`."""

from __future__ import annotations
from pathlib import Path
from typing import Optional, List, Dict, Any, Union

# ← THIS is critical so @register works below:
from .cli import register

import json
from dataclasses import dataclass, asdict

# ─── Parameter dataclasses ─────────────────────────
@dataclass
class ScanParams:
    root: Optional[Path]
    workers: int = 4
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "root": str(self.root) if self.root else None,
            "workers": self.workers
        }

@dataclass
class SyncAlbumParams:
    root:     Path
    album:    Optional[str]
    category: str = "edit"
    copy:     bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "root": str(self.root),
            "album": self.album,
            "category": self.category,
            "copy": self.copy
        }

@dataclass
class BackupParams:
    backup_root: Path
    dry_run:     bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "backup_root": str(self.backup_root),
            "dry_run": self.dry_run
        }

@dataclass
class RecentParams:
    limit: int = 10
    
    def to_dict(self) -> Dict[str, Any]:
        return {"limit": self.limit}

@dataclass
class DumpParams:
    fmt: str = "json"    # "json" or "csv"
    
    def to_dict(self) -> Dict[str, Any]:
        return {"format": self.fmt}

@dataclass
class SearchParams:
    query: str
    mime:  Optional[str] = None
    limit: int = 50

    def to_dict(self):
        return {"q": self.query, "mime": self.mime, "limit": self.limit}

@dataclass
class CleanParams:
    confirm: bool = False

    def to_dict(self):
        return {"confirm": self.confirm}

# Result dataclasses
@dataclass
class ScanResult:
    processed: int
    errors:    int
    total:     int
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class SyncResult:
    category: str
    album:    str
    synced:   int
    skipped:  int
    dest:     str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class BackupResult:
    copied:  int
    skipped: int
    dest:    str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# Type aliases for convenience
CommandParams = Union[
    ScanParams, 
    SyncAlbumParams, 
    BackupParams, 
    RecentParams, 
    DumpParams, 
    SearchParams, 
    CleanParams
]

CommandResult = Union[
    ScanResult, 
    SyncResult, 
    BackupResult, 
    Dict[str, Any], 
    List[Dict[str, Any]]
]

# Helper functions
def serialize_result(result: CommandResult) -> Dict[str, Any] | List[Dict[str, Any]] | str:
    """Convert result to JSON-serializable format."""
    if hasattr(result, 'to_dict'):
        return result.to_dict()
    elif isinstance(result, (dict, list, str, int, float, bool, type(None))):
        return result
    else:
        return str(result)

def create_params_from_dict(action: str, data: Dict[str, Any]) -> CommandParams:
    """Factory function to create appropriate params from dict."""
    if action == "scan":
        root = Path(data["root"]) if data.get("root") else None
        return ScanParams(root=root, workers=data.get("workers", 4))
    
    elif action == "sync_album":
        return SyncAlbumParams(
            root=Path(data["root"]),
            album=data.get("album"),
            category=data.get("category", "edit"),
            copy=data.get("copy", True)
        )
    
    elif action == "backup":
        return BackupParams(
            backup_root=Path(data["backup_root"]),
            dry_run=data.get("dry_run", False)
        )
    
    elif action == "recent":
        return RecentParams(limit=data.get("limit", 10))
    
    elif action == "dump":
        return DumpParams(fmt=data.get("format", "json"))
    
    else:
        raise ValueError(f"Unknown action: {action}")


# ─── Command Implementations ─────────────────────────
# stats and recent can just return built-in types (dict or list[dict])
@register("transcode", help="HW-transcode to H.264 or HEVC")
def cmd_transcode(args):
    from . import hwaccel
    if not hwaccel.has_vc7():
        print("No VideoCore VII detected – falling back is TODO.")
        return
    hwaccel.transcode_hw(args.src, args.dst, vcodec=args.codec)

@register("thumbnails", help="GPU thumbnail sheet generator")
def cmd_thumbs(args):
    from . import hwaccel, preview
    from pathlib import Path
    Path(args.out).mkdir(parents=True, exist_ok=True)
    for i, frame in enumerate(hwaccel.frame_iter_hw(args.src)):
        if i % args.step == 0:
            preview.save_thumbnail(frame, Path(args.out)/f"{i:04d}.jpg")