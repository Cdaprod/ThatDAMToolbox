"""Tests for Python event bus facade."""

from unittest import mock

from video import eventbus


def test_publish_uses_connection():
    ch = mock.Mock()
    conn = mock.Mock()
    conn.channel.return_value = ch
    with mock.patch("pika.BlockingConnection", return_value=conn):
        bus = eventbus.connect("amqp:///")
        eventbus.publish("foo", {"a": 1})
        ch.basic_publish.assert_called()
        bus.close()

