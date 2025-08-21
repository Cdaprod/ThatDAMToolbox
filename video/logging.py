"""Central logging configuration for the video service.

Example:
    from video.logging import configure_logging
    configure_logging()
"""
from __future__ import annotations

import contextvars
import logging
import os
from typing import Optional

_CONFIGURED = False

tenant_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("tenant_id", default="-")
principal_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("principal_id", default="-")


class _HealthCheckFilter(logging.Filter):
    """Filter out access logs for /health endpoint."""
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return "/health" not in msg


class _ContextFilter(logging.Filter):
    """Inject tenant and principal context into log records."""
    def filter(self, record: logging.LogRecord) -> bool:  # noqa: D401
        record.tenant_id = tenant_id_var.get()
        record.principal_id = principal_id_var.get()
        return True


def configure_logging(level: Optional[int | str] = None) -> None:
    """Configure root logging once.

    Parameters
    ----------
    level: int | str, optional
        Explicit log level (e.g. ``logging.DEBUG`` or ``"INFO"``).  If not
        provided, ``VIDEO_LOG_LEVEL`` environment variable is consulted.

    This function is idempotent – subsequent calls are no-ops.
    """
    global _CONFIGURED
    if _CONFIGURED:
        return

    if level is None:
        env_level = os.getenv("VIDEO_LOG_LEVEL", "INFO")
        level = logging.getLevelName(env_level)

    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s tenant=%(tenant_id)s principal=%(principal_id)s: %(message)s",
        force=True,
    )

    root = logging.getLogger()
    root.addFilter(_ContextFilter())

    # Silence /health requests from uvicorn.access
    uvicorn_access = logging.getLogger("uvicorn.access")
    uvicorn_access.addFilter(_HealthCheckFilter())

    _CONFIGURED = True


__all__ = ["configure_logging", "tenant_id_var", "principal_id_var"]
