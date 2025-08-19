"""Tests for rabbitmq_connector return handler compatibility.

Example:
    pytest video/tests/test_rabbitmq_connector.py
"""

from video.core.event.rabbitmq_connector import _install_return_handler


class LegacyChan:
    def set_return_listener(self, cb):
        self.cb = cb


class ModernChan:
    def add_on_return_callback(self, cb):
        self.cb = cb


class NoopChan:
    pass


def test_install_return_handler_legacy():
    ch = LegacyChan()
    _install_return_handler(ch)
    assert hasattr(ch, "cb")


def test_install_return_handler_modern():
    ch = ModernChan()
    _install_return_handler(ch)
    assert hasattr(ch, "cb")


def test_install_return_handler_missing():
    ch = NoopChan()
    _install_return_handler(ch)  # should not raise
