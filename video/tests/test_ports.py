"""Tests for tenant-aware ports."""
import sqlite3
import pytest

from video.core.ports import (
    RelationalStorePort,
    UsageLimits,
    UsageMeterPort,
    tenant_prefix,
)


def test_relational_store_port_scopes_queries(tmp_path):
    db_file = tmp_path / "db.sqlite"

    def connect():
        return sqlite3.connect(db_file)

    with connect() as cx:
        cx.execute("CREATE TABLE items (tenant_id TEXT, value TEXT)")
        cx.execute("INSERT INTO items VALUES ('t1', 'a')")
        cx.execute("INSERT INTO items VALUES ('t2', 'b')")

    port = RelationalStorePort(connect, "t1")
    rows = port.execute("SELECT value FROM items").fetchall()
    assert rows == [("a",)]
    port.execute("INSERT INTO items (value) VALUES (?)", ("c",))
    with connect() as cx:
        vals = cx.execute("SELECT tenant_id, value FROM items WHERE tenant_id='t1'").fetchall()
        assert ("t1", "c") in vals


def test_usage_meter_port_isolated(monkeypatch):
    events = []
    monkeypatch.setattr("video.core.ports.publish", lambda topic, payload: events.append((topic, payload)))

    m1 = UsageMeterPort("t1", UsageLimits(ingest=1))
    m1.record_ingest()
    with pytest.raises(RuntimeError):
        m1.record_ingest()
    assert events[0][1]["tenant_id"] == "t1"

    m2 = UsageMeterPort("t2", UsageLimits(ingest=1))
    m2.record_ingest()
    assert len(events) == 1


def test_tenant_prefix():
    assert tenant_prefix("42", "key") == "tenant/42/key"
