"""Tests for graceful degradation when pika is unavailable."""

import importlib
import sys


def test_publish_noop_without_pika(monkeypatch):
    """connect() should return a no-op bus if pika is missing."""
    monkeypatch.setitem(sys.modules, "pika", None)
    eventbus = importlib.reload(importlib.import_module("video.eventbus"))
    bus = eventbus.connect()
    bus.publish("test.topic", {"foo": "bar"})  # should not raise
    assert bus.__class__.__name__ == "_NullBus"
    importlib.reload(eventbus)

