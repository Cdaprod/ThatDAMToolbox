# /video/config.py

from pathlib import Path
import configparser
import os

# ─── INI Config Path (allow override via $VIDEO_CFG) ─────────────────────────
_cfg_path = Path(os.getenv("VIDEO_CFG", str(Path.home() / "video" / "video.cfg")))
_cfg = configparser.ConfigParser()
_cfg.read(_cfg_path)

# ─── Core Getters ────────────────────────────────────────────────────────────
def get(section: str, key: str, default: str | None = None) -> str | None:
    return _cfg.get(section, key, fallback=default)

def get_path(section: str, key: str, default: str | None = None) -> Path | None:
    val = get(section, key, default)
    return Path(val) if val else None

def _write_cfg():
    with open(_cfg_path, "w") as f:
        _cfg.write(f)

# ─── Dynamic Path Management ─────────────────────────────────────────────────
def add_network_path(path_str):
    lst = get_network_paths()
    p = Path(path_str).expanduser()
    if str(p) not in [str(x) for x in lst]:
        _cfg.set("paths", "network_paths", ", ".join([str(x) for x in lst] + [str(p)]))
        _write_cfg()
        return True
    return False  # duplicate

def remove_network_path(idx):
    lst = get_network_paths()
    try:
        removed = lst.pop(idx)
    except IndexError:
        raise ValueError("Invalid index")
    _cfg.set("paths", "network_paths", ", ".join(str(x) for x in lst))
    _write_cfg()
    return removed

def get_network_paths(section: str = "paths", key: str = "network_paths") -> list[Path]:
    """
    Read a comma-separated list of network mounts from [paths] network_paths
    """
    val = get(section, key)
    if not val:
        return []
    return [Path(p.strip()).expanduser() for p in val.split(",") if p.strip()]

def get_network_globs(section="paths", key="network_globs") -> list[Path]:
    val = get(section, key)
    if not val:
        return []
    out = []
    for pat in val.split(","):
        for p in Path().glob(pat.strip()):
            out.append(p)
    return out

# ─── Structured Data/Media/App Dirs (NEW) ────────────────────────────────────
def _default_dir(env_name, cfg_section, cfg_key, fallback):
    # INI -> ENV -> fallback
    return (
        get_path(cfg_section, cfg_key)
        or Path(os.getenv(env_name, fallback))
    )
    
def get_app_subdir(name: str) -> Path:
    """Get (and ensure) a named subdirectory under [paths].root."""
    root = get_path("paths", "root") or Path.home() / "video"
    subdir = root / name
    subdir.mkdir(parents=True, exist_ok=True)
    return subdir

INCOMING_DIR  = get_path("paths", "incoming") or get_app_subdir("_INCOMING")
DATA_DIR      = _default_dir("VIDEO_DATA_DIR", "paths", "data_dir",      str(Path.home() / "thatdamtoolbox"))
MEDIA_ROOT    = _default_dir("VIDEO_MEDIA_ROOT", "paths", "media_root",  str(DATA_DIR / "media"))
PREVIEW_ROOT  = _default_dir("VIDEO_PREVIEW_ROOT", "paths", "preview_root", str(DATA_DIR / "previews"))
DB_PATH       = _default_dir("VIDEO_DB_PATH", "paths", "db_path",        str(DATA_DIR / "db" / "media_index.sqlite3"))
LOG_DIR       = _default_dir("VIDEO_LOG_DIR", "paths", "log_dir",        str(DATA_DIR / "logs"))
TMP_DIR       = _default_dir("VIDEO_TMP_DIR", "paths", "tmp_dir",        str(DATA_DIR / "tmp"))

def ensure_dirs():
    for p in [DATA_DIR, MEDIA_ROOT, PREVIEW_ROOT, LOG_DIR, TMP_DIR, DB_PATH.parent]:
        try:
            p.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"⚠️ Could not create {p}: {e}")

ensure_dirs()  # Auto-create on import

# ─── All Scan Roots ─────────────────────────────────────────────────────────
def get_all_roots() -> list[Path]:
    """
    Return all root dirs for scanning: MEDIA_ROOT + all network mounts + globs
    """
    roots = []
    # Support legacy [paths] root, but prefer MEDIA_ROOT
    primary = get_path("paths", "root")
    if primary:
        roots.append(primary)
    if MEDIA_ROOT not in roots:
        roots.append(MEDIA_ROOT)
    roots += get_network_paths()
    roots += get_network_globs()
    # dedupe & filter exists
    seen = set(); final = []
    for p in roots:
        if p.exists() and p not in seen:
            seen.add(p); final.append(p)
    return final

def get_preview_root():
    _env = os.getenv("VIDEO_PREVIEW_ROOT")
    _cfg = get_path("paths", "preview_root")
    _default = DATA_DIR / "previews"  # Now this is always under your DATA_DIR
    return Path(_env) if _env else Path(_cfg) if _cfg else _default

# ─── Utility: Dump Current Config (Optional) ────────────────────────────────
def print_config():
    print(f"DATA_DIR:     {DATA_DIR}")
    print(f"MEDIA_ROOT:   {MEDIA_ROOT}")
    print(f"PREVIEW_ROOT: {PREVIEW_ROOT}")
    print(f"DB_PATH:      {DB_PATH}")
    print(f"LOG_DIR:      {LOG_DIR}")
    print(f"TMP_DIR:      {TMP_DIR}")
    print(f"SCAN ROOTS:   {get_all_roots()}")