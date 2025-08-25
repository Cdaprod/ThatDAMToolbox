"""Ensure live-preview.js can be imported in a minimal DOM shim.

Example:
    pytest js_tests/test_live_preview_fetch.py -q
"""
from __future__ import annotations

import subprocess
from pathlib import Path

def test_live_preview_import(tmp_path: Path) -> None:
    script = tmp_path / 'run.js'
    script.write_text(
        """
const assert = require('assert');

global.fetch = async () => ({ ok: true, json: async () => ({}) });
class Element { addEventListener(){} }
const elem = new Element();

global.document = {
  addEventListener: (ev, cb) => { if (ev === 'DOMContentLoaded') cb(); },
  querySelectorAll: () => [],
  getElementById: () => elem,
  createElement: () => elem,
};

global.Event = class { constructor(type){ this.type = type; } };
require(require('path').join(process.cwd(), 'video/web/static/components/live-preview.js'));
""",
        encoding='utf-8',
    )
    repo_root = Path(__file__).resolve().parents[1]
    result = subprocess.run([
        'node', str(script)
    ], cwd=repo_root, capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
