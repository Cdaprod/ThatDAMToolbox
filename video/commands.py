# video/commands.py

from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Dict, Any

@dataclass
class ScanParams:
    root: Optional[Path]
    workers: int = 4

@dataclass
class SyncAlbumParams:
    root:     Path
    album:    Optional[str]
    category: str = "edit"
    copy:     bool = True

@dataclass
class BackupParams:
    backup_root: Path
    dry_run:     bool = False

@dataclass
class RecentParams:
    limit: int = 10

@dataclass
class DumpParams:
    fmt: str = "json"    # "json" or "csv"


@dataclass
class ScanResult:
    processed: int
    errors:    int
    total:     int

@dataclass
class SyncResult:
    category: str
    album:    str
    synced:   int
    skipped:  int
    dest:     str

@dataclass
class BackupResult:
    copied:  int
    skipped: int
    dest:    str

# stats and recent can just return built-in types (dict or list[dict])