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