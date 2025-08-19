"""Unit tests for :func:`video.commands.cmd_transcode`."""

from types import SimpleNamespace

from video.commands import cmd_transcode


def test_cmd_transcode_hw(monkeypatch, tmp_path):
    src = tmp_path / "in.mp4"
    src.write_bytes(b"0")
    dst = tmp_path / "out.mp4"

    called = {}
    from video import hwaccel

    monkeypatch.setattr(hwaccel, "has_vc7", lambda: True)
    monkeypatch.setattr(hwaccel, "transcode_hw", lambda s, d, vcodec: called.setdefault("args", (s, d, vcodec)))

    cmd_transcode(SimpleNamespace(src=str(src), dst=str(dst), codec="h264"))

    assert called["args"] == (str(src), str(dst), "h264")


def test_cmd_transcode_sw(monkeypatch, tmp_path):
    src = tmp_path / "in.mp4"
    src.write_bytes(b"0")
    dst = tmp_path / "out.mp4"

    from video import hwaccel
    from video.core import transcode as sw

    monkeypatch.setattr(hwaccel, "has_vc7", lambda: False)
    called = {}
    monkeypatch.setattr(sw, "transcode_sw", lambda s, d, vcodec: called.setdefault("args", (s, d, vcodec)))

    cmd_transcode(SimpleNamespace(src=str(src), dst=str(dst), codec="hevc"))

    assert called["args"] == (str(src), str(dst), "hevc")
