# /video/lifecycle.py
from __future__ import annotations
import atexit, logging, signal
from contextlib import contextmanager
from typing import Callable, List

_log          = logging.getLogger("video.lifecycle")
_STARTUP_DONE = False
_CLEANERS: List[Callable[[], None]] = []

# ------------------------------------------------------------------ #
def on_shutdown(fn: Callable[[], None]) -> None:
    """Modules call this to register their cleanup callback exactly once."""
    _CLEANERS.append(fn)

def startup() -> None:
    """Initialise once – idempotent."""
    global _STARTUP_DONE
    if _STARTUP_DONE:
        return
    _STARTUP_DONE = True
    _log.debug("Lifecycle startup complete")

def shutdown() -> None:
    """Run every registered cleaner in reverse order."""
    _log.info("Running %d shutdown handlers", len(_CLEANERS))
    while _CLEANERS:
        fn = _CLEANERS.pop()
        try:
            fn()
        except Exception as e:
            _log.warning("Shutdown handler %s failed: %s", fn, e)

# --- guarantee cleanup on ^C or normal exit ----------------------- #
for sig in (signal.SIGINT, signal.SIGTERM):
    signal.signal(sig, lambda *_: shutdown())
atexit.register(shutdown)

# ------------------------------------------------------------------ #
@contextmanager
def lifecycle_ctx():
    """With-statement helper for CLI commands."""
    startup()
    try:
        yield
    finally:
        shutdown()