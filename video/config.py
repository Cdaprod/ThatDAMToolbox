# /video/config.py

from pathlib import Path
import configparser
import os
import logging
import tempfile

log = logging.getLogger("video.config")

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
def _default_dir(env_name: str, cfg_section: str, cfg_key: str, fallback: str) -> Path:
    """
    Resolve a directory via:
      1. INI config [cfg_section][cfg_key]
      2. ENV var env_name
      3. literal fallback
    Ensure it exists and is writable. If not, fallback to /tmp/thatdamtoolbox/<leaf>.
    """
    cfg_val = get_path(cfg_section, cfg_key)
    if cfg_val:
        directory = cfg_val
    else:
        env_val = os.getenv(env_name)
        directory = Path(env_val) if env_val else Path(fallback)

    # Ensure we get only the directory part for files passed as fallback
    if directory.suffix:  # It's a file, not a dir!
        directory = directory.parent

    try:
        directory.mkdir(parents=True, exist_ok=True)
        test_file = directory / ".write_test"
        test_file.touch(exist_ok=True)
        test_file.unlink(missing_ok=True)
        log.debug("Using configured directory for %s: %s", cfg_key, directory)
        return directory
    except Exception as e:
        log.warning(
            "Configured directory %s at %s not writable; error=%s. Falling back to temp.",
            cfg_key, directory, e
        )

    # fallback: /tmp/thatdamtoolbox/<cfg_key>
    temp_base = Path(tempfile.gettempdir()) / "thatdamtoolbox" / cfg_key
    try:
        temp_base.mkdir(parents=True, exist_ok=True)
        test_file = temp_base / ".write_test"
        test_file.touch(exist_ok=True)
        test_file.unlink(missing_ok=True)
        log.warning("Using temp fallback directory for %s: %s", cfg_key, temp_base)
        return temp_base
    except Exception as e:
        log.error("Could not create or write to temp fallback dir %s: %s", temp_base, e)
        fallback_dir = Path(tempfile.gettempdir())
        try:
            fallback_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
        log.error("Could not use any custom fallback, defaulting to bare tmp: %s", fallback_dir)
        return fallback_dir

def _default_file(env_name: str, cfg_section: str, cfg_key: str, fallback: str) -> Path:
    """
    Like _default_dir but for a file path (e.g., SQLite DB).
    Returns a file path, falling back to /tmp/thatdamtoolbox/<cfg_key>.sqlite3 if necessary.
    """
    cfg_val = get_path(cfg_section, cfg_key)
    if cfg_val:
        fpath = cfg_val
    else:
        env_val = os.getenv(env_name)
        fpath = Path(env_val) if env_val else Path(fallback)
    directory = fpath.parent

    try:
        directory.mkdir(parents=True, exist_ok=True)
        test_file = directory / ".write_test"
        test_file.touch(exist_ok=True)
        test_file.unlink(missing_ok=True)
        log.debug("Using configured file for %s: %s", cfg_key, fpath)
        return fpath
    except Exception as e:
        log.warning(
            "Configured file %s at %s not writable; error=%s. Falling back to temp.",
            cfg_key, fpath, e
        )
    # fallback: /tmp/thatdamtoolbox/<cfg_key>.sqlite3
    fallback_base = Path(tempfile.gettempdir()) / "thatdamtoolbox"
    fallback_base.mkdir(parents=True, exist_ok=True)
    fallback_file = fallback_base / (cfg_key + ".sqlite3")
    log.warning("Using temp fallback file for %s: %s", cfg_key, fallback_file)
    return fallback_file
    
def get_app_subdir(name: str) -> Path:
    """Get (and ensure) a named subdirectory under [paths].root."""
    root = get_path("paths", "root") or Path.home() / "video"
    subdir = root / name
    try:
        subdir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        log.warning(
            "Could not create app subdir %r at %s (%s); falling back to temp",
            name, subdir, e
        )
        import tempfile
        subdir = Path(tempfile.gettempdir()) / name
        try:
            subdir.mkdir(parents=True, exist_ok=True)
        except Exception as e2:
            log.error("Failed to create fallback temp subdir %s: %s", subdir, e2)
    return subdir

def _data_env_or_default(env, sub):
    """Always prefer $VIDEO_DATA_DIR if set, else /data, else fallback."""
    base = os.getenv("VIDEO_DATA_DIR", "/data")
    val = os.getenv(env, str(Path(base) / sub))
    return Path(val)

INCOMING_DIR  = _data_env_or_default("VIDEO_INCOMING_DIR", "_INCOMING")
DATA_DIR      = Path(os.getenv("VIDEO_DATA_DIR", "/data"))
MEDIA_ROOT    = _data_env_or_default("VIDEO_MEDIA_ROOT", "media")
PROCESSED_DIR = _data_env_or_default("VIDEO_PROCESSED_DIR", "_PROCESSED")
PREVIEW_ROOT  = _data_env_or_default("VIDEO_PREVIEW_ROOT", "previews")
DB_PATH       = Path(os.getenv(
    "VIDEO_DB_PATH",
    str(DATA_DIR / "db" / "media_index.sqlite3")
))
LOG_DIR       = _data_env_or_default("VIDEO_LOG_DIR", "logs")
TMP_DIR       = _data_env_or_default("VIDEO_TMP_DIR", "tmp")

WEB_UPLOADS   = get_path("paths", "web_uploads") or (INCOMING_DIR / "sources/WEB_UPLOADS")
WEB_UPLOADS.mkdir(parents=True, exist_ok=True)

MODULES_BASE = DATA_DIR / "thatdamtoolbox" / "modules"
MODULES_BASE.mkdir(parents=True, exist_ok=True)

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
    

# ──────────────────────────────────────────────────────────────────────────
#  create all required directories – no more console spam
# ──────────────────────────────────────────────────────────────────────────
log = logging.getLogger("video.config")
_DIRS_CREATED = False          # idempotence guard

def ensure_dirs(*, verbose: bool = False) -> None:
    """
    Create every runtime directory exactly **once** per process.

    • When `verbose=True` (or env VIDEO_VERBOSE_DIRS=1) we log at INFO.  
    • Otherwise messages are DEBUG – invisible unless you enable them.
    """
    global _DIRS_CREATED
    if _DIRS_CREATED:
        return                # already done in this interpreter

    targets = [
        DATA_DIR, MEDIA_ROOT, PROCESSED_DIR, PREVIEW_ROOT, LOG_DIR, TMP_DIR,
        DB_PATH.parent, INCOMING_DIR, WEB_UPLOADS
    ]
    for p in targets:
        try:
            p.mkdir(parents=True, exist_ok=True)
            msg = "Ensured directory: %s", p
            if verbose or os.getenv("VIDEO_VERBOSE_DIRS") == "1":
                log.info(*msg)
            else:
                log.debug(*msg)
        except Exception as e:
            log.warning("Could not create %s: %s", p, e)

    _DIRS_CREATED = True


# ─── Module‐specific path registry ─────────────────────────────────────────────
_MODULE_PATH_REGISTRY: dict[str, dict[str, Path]] = {}

def register_module_paths(module_name: str, defaults: dict[str, Path]) -> None:
    """
    Let a module declare its own folders.  Writes a `module.cfg` beside
    the module’s package, under [module:<module_name>].

    Example:
      video/modules/motion_extractor/module.cfg
      [module:motion_extractor]
      frames = /data/web_frames
      outputs = /data/motion_outputs
    """
    import importlib.util
    # 1) Find the module’s directory
    spec = importlib.util.find_spec(f"video.modules.{module_name}")
    if not spec or not spec.origin:
        raise ImportError(f"Cannot locate video.modules.{module_name!r}")
    module_dir = Path(spec.origin).parent

    # 2) Load (or create) module-specific config
    module_cfg_path = module_dir / "module.cfg"
    module_cfg = configparser.ConfigParser()
    if module_cfg_path.exists():
        module_cfg.read(module_cfg_path)

    section = f"module:{module_name}"
    if not module_cfg.has_section(section):
        module_cfg.add_section(section)

    # 3) Resolve each key, attempt to create directories (but don’t fail if unwritable)
    resolved: dict[str, Path] = {}
    for key, fallback in defaults.items():
        if module_cfg.has_option(section, key):
            p = Path(module_cfg.get(section, key)).expanduser()
        else:
            p = fallback
            module_cfg.set(section, key, str(p))

        # try to create it, but swallow permission errors
        try:
            p.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            log.warning(
                "Could not create module path %s:%s at %s – %s",
                module_name, key, p, e
            )
        # register it anyway (even if we couldn’t make it on disk)
        resolved[key] = p

    # 4) Write back only this module’s config file
    try:
        with open(module_cfg_path, "w") as f:
            module_cfg.write(f)
        log.info(
            "Wrote module config for %r to %s",
            module_name,
            module_cfg_path
        )
    except Exception as e:
        log.warning(
            "Failed to write module config for %r at %s: %s",
            module_name,
            module_cfg_path,
            e
        )

    # 5) Populate the in-memory registry for get_module_path()
    _MODULE_PATH_REGISTRY[module_name] = resolved

def get_module_path(module_name: str, key: str) -> Path:
    """
    Retrieve the Path for a module’s registered key.
    Raises KeyError if module or key was never registered.
    """
    try:
        return _MODULE_PATH_REGISTRY[module_name][key]
    except KeyError:
        raise KeyError(f"No path registered for module={module_name!r}, key={key!r}")

# ─── End of module path registry ─────────────────────────────────────────────
  