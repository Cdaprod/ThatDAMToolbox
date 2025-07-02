# video/config.py  (new)
from pathlib import Path
import configparser, os

_cfg_path = Path(os.getenv("VIDEO_CFG", Path.home() / "video" / "video.cfg"))
_cfg.read(_cfg_path)

def get(section: str, key: str, default: str | None = None) -> str | None:
    return _cfg.get(section, key, fallback=default)

def get_path(section: str, key: str, default: str | None = None) -> Path | None:
    val = get(section, key, default)
    return Path(val) if val else None