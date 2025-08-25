"""Validate ffmpeg-console.js command execution via Node.js.

Example:
    pytest js_tests/test_ffmpeg_console_run.py
"""
from __future__ import annotations

import subprocess
from pathlib import Path


def test_ffmpeg_run(tmp_path: Path) -> None:
    """Ensure the console issues a fetch to /api/v1/ffmpeg."""

    script = tmp_path / "run.js"
    script.write_text(
        """
const assert = require('assert');
let fetchCalls = [];
global.fetch = async (url, opts = {}) => {
  fetchCalls.push({ url, opts });
  if (url.startsWith('/api/v1/ffmpeg/history')) {
    return { ok: true, json: async () => [] };
  }
  if (url.startsWith('/api/v1/explorer/assets')) {
    return { ok: true, json: async () => [{ path: '/vid/a.mp4' }] };
  }
      if (url === '/api/v1/ffmpeg/run') {
        return { ok: true, json: async () => ({ exit: 0, elapsed: 0.1, stdout: 'ok' }) };
      }
  return { ok: false, json: async () => ({}) };
};

class Element {
  constructor() {
    this.value = '';
    this.innerHTML = '';
    this.textContent = '';
    this.classList = { add: () => {}, remove: () => {} };
    this.disabled = false;
    this.files = [];
    this._listeners = {};
    this.style = {};
  }
  addEventListener(ev, cb) { this._listeners[ev] = cb; }
  dispatchEvent(ev) { if (this._listeners[ev.type]) this._listeners[ev.type](ev); }
  appendChild() {}
}

const els = {};
['ff-quick-select','ff-file-input','ff-asset-select','ff-output-name','ff-input','ff-run','ff-history-list','ff-output','ff-clear-file'].forEach(id => { els[id] = new Element(); });
els['ff-input'].value = 'echo test';

global.document = {
  addEventListener: (ev, cb) => { if (ev === 'DOMContentLoaded') cb(); },
  getElementById: (id) => els[id],
  createElement: () => new Element(),
};

global.Event = class { constructor(type){ this.type = type; } };

require(require('path').join(process.cwd(), 'video/web/static/components/ffmpeg-console.js'));

(async () => {
  await new Promise(r => setImmediate(r));
  els['ff-run'].onclick();
  await new Promise(r => setImmediate(r));
  assert(fetchCalls.some(c => c.url === '/api/v1/ffmpeg/run'));
})();
""",
        encoding="utf-8",
    )

    repo_root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        ["node", str(script)],
        cwd=repo_root,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
