"""Core ports providing tenant-aware helpers.

Example:
    port = RelationalStorePort(lambda: sqlite3.connect("/tmp/db.sqlite"), "t1")
    port.execute("SELECT * FROM items")
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Any, Callable, Sequence

from video.eventbus import publish


def tenant_prefix(tenant_id: str, key: str) -> str:
    """Prefix ``key`` with ``tenant/{id}`` for isolation."""
    return f"tenant/{tenant_id}/{key}"


class RelationalStorePort:
    """Wrap SQL execution and automatically scope by ``tenant_id``."""

    def __init__(self, connect: Callable[[], sqlite3.Connection], tenant_id: str) -> None:
        self._connect = connect
        self.tenant_id = tenant_id

    def execute(self, sql: str, params: Sequence[Any] | None = None):
        params = list(params or [])
        normalized = sql.strip().lower()

        if normalized.startswith("select"):
            if "where" in normalized:
                sql += " AND tenant_id = ?"
            else:
                sql += " WHERE tenant_id = ?"
            params.append(self.tenant_id)
        elif normalized.startswith("insert"):
            idx = normalized.find("values")
            cols_part = sql[:idx]
            vals_part = sql[idx:]
            cols_part = cols_part.replace("(", "(tenant_id, ", 1)
            vals_part = vals_part.replace("VALUES (", "VALUES (?, ", 1)
            sql = cols_part + vals_part
            params.insert(0, self.tenant_id)
        else:
            if "where" in normalized:
                sql += " AND tenant_id = ?"
            else:
                sql += " WHERE tenant_id = ?"
            params.append(self.tenant_id)

        with self._connect() as cx:
            return cx.execute(sql, params)


@dataclass
class UsageLimits:
    ingest: int = 0
    transcode: int = 0


class UsageMeterPort:
    """Track per-tenant usage and emit limit events."""

    def __init__(self, tenant_id: str, limits: UsageLimits) -> None:
        self.tenant_id = tenant_id
        self.limits = limits
        self._usage = {"ingest": 0, "transcode": 0}

    def record_ingest(self, count: int = 1) -> None:
        self._usage["ingest"] += count
        if self.limits.ingest and self._usage["ingest"] > self.limits.ingest:
            publish("tenant.limit", {"tenant_id": self.tenant_id, "metric": "ingest"})
            raise RuntimeError("ingest limit exceeded")

    def record_transcode(self, count: int = 1) -> None:
        self._usage["transcode"] += count
        if self.limits.transcode and self._usage["transcode"] > self.limits.transcode:
            publish("tenant.limit", {"tenant_id": self.tenant_id, "metric": "transcode"})
            raise RuntimeError("transcode limit exceeded")
