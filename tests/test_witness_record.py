"""Tests for witness recording helper."""
import sys
import types
import pytest

# Provide a tiny cv2 shim if OpenCV isn't installed.
if 'cv2' not in sys.modules:
    sys.modules['cv2'] = types.SimpleNamespace(
        VideoCapture=lambda *a, **k: None,
        VideoWriter=lambda *a, **k: None,
        VideoWriter_fourcc=lambda *a, **k: 0,
        destroyAllWindows=lambda: None,
        imshow=lambda *a, **k: None,
        waitKey=lambda *a, **k: 0,
        warpAffine=lambda *a, **k: None,
    )

from video.modules.hwcapture import hwcapture


class _DummyCap:
    def release(self):
        pass


class _DummyWriter:
    def write(self, frame):
        pass

    def release(self):
        pass


def _stub_cv(monkeypatch):
    monkeypatch.setattr(hwcapture.cv2, "VideoCapture", lambda dev: _DummyCap())
    monkeypatch.setattr(hwcapture.cv2, "VideoWriter", lambda *a, **k: _DummyWriter())
    monkeypatch.setattr(hwcapture.cv2, "VideoWriter_fourcc", lambda *a, **k: 0)
    monkeypatch.setattr(hwcapture.cv2, "destroyAllWindows", lambda: None)
    class Info:
        width = 640
        height = 480
        fps = 30
    monkeypatch.setattr(
        hwcapture.DeviceManager, "get_device_info", lambda dev: Info
    )


def test_record_with_witness_success(monkeypatch):
    monkeypatch.setattr(hwcapture, "validate_device", lambda d: True)
    _stub_cv(monkeypatch)
    hwcapture.record_with_witness("/dev/video0", "/dev/video1", duration=0)


def test_record_with_witness_invalid_device(monkeypatch):
    monkeypatch.setattr(
        hwcapture, "validate_device", lambda d: d == "/dev/video0"
    )
    with pytest.raises(ValueError):
        hwcapture.record_with_witness("/dev/video0", "/dev/bad", duration=0)
