"""Tests for tenant-aware logging context."""
import logging

from video.logging import configure_logging, tenant_id_var, principal_id_var, _ContextFilter


def test_log_includes_tenant():
    configure_logging()
    t = tenant_id_var.set("acme")
    p = principal_id_var.set("u1")
    rec = logging.LogRecord("test", logging.INFO, __file__, 0, "hello", (), None)
    _ContextFilter().filter(rec)
    tenant_id_var.reset(t)
    principal_id_var.reset(p)
    assert getattr(rec, "tenant_id", "") == "acme"

