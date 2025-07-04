# video/config.py

from pathlib import Path
import configparser
import os

# 1) Build the path to your INI (allow override via $VIDEO_CFG)
_cfg_path = Path(
    os.getenv("VIDEO_CFG", str(Path.home() / "video" / "video.cfg"))
)

# 2) Create the parser and read the file (if it exists)
_cfg = configparser.ConfigParser()
_cfg.read(_cfg_path)

def get(section: str, key: str, default: str | None = None) -> str | None:
    """
    Return the value for [section] key from the config file,
    or `default` if missing.
    """
    return _cfg.get(section, key, fallback=default)

def get_path(section: str, key: str, default: str | None = None) -> Path | None:
    """
    Like `get()`, but converts the result to a pathlib.Path,
    or returns None if no value.
    """
    val = get(section, key, default)
    return Path(val) if val else None

def _write_cfg():
    with open(_cfg_path, "w") as f:
        _cfg.write(f)

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
    return [
        Path(p.strip()).expanduser()
        for p in val.split(",")
        if p.strip()
    ]

def get_network_globs(section="paths", key="network_globs") -> list[Path]:
    val = get(section, key)
    if not val:
        return []
    out = []
    for pat in val.split(","):
        for p in Path().glob(pat.strip()):
            out.append(p)
    return out

def get_all_roots() -> list[Path]:
    roots = []
    primary = get_path("paths", "root")
    if primary: roots.append(primary)
    roots += get_network_paths()
    roots += get_network_globs()
    # dedupe & filter exists
    seen = set(); final = []
    for p in roots:
        if p.exists() and p not in seen:
            seen.add(p); final.append(p)
    return final
 