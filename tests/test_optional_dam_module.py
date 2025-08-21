"""Ensure optional DAM module is skipped when heavy deps are missing.

Run tests with:
    pytest -q tests/test_optional_dam_module.py
"""

import importlib
import sys
import builtins


def test_missing_dam_module_skipped(monkeypatch):
    """Importing `video.modules` should succeed without DAM extras."""
    heavy = {"torch", "torchvision", "transformers", "whisper", "open_clip"}

    orig_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name in heavy:
            raise ImportError("missing optional dependency")
        return orig_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    sys.modules.pop("video.modules", None)
    mod = importlib.import_module("video.modules")
    assert isinstance(mod.routers, list)
    assert "video.modules.dam" not in sys.modules

