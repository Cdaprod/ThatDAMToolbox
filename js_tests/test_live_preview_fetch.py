"""Validate live-preview.js recording endpoints via Node.js.

Example:
    pytest js_tests/test_live_preview_fetch.py
"""

from __future__ import annotations

import subprocess
from pathlib import Path


def test_fetch_endpoints(tmp_path: Path) -> None:
    """Run the Node.js harness and ensure it exits successfully."""

    script = tmp_path / "run.js"
    script.write_text(
        """
const assert = require('assert');

(async () => {
  const fetchCalls = [];
  let jobCounter = 1;
  global.fetch = async (url, opts = {}) => {
    fetchCalls.push({ url, opts });
    if (url === '/hwcapture/devices') {
      return { ok: true, json: async () => [
        { path: '/dev/video0', width: 640, height: 480, fps: 30 },
        { path: '/dev/video1', width: 640, height: 480, fps: 30 },
      ] };
    }
    if (url.startsWith('/hwcapture/record?')) {
      return { ok: true, json: async () => ({ job: `job${jobCounter++}` }) };
    }
    if (url.startsWith('/hwcapture/record/')) {
      return { ok: true, json: async () => ({}) };
    }
    return { ok: false, json: async () => ({}) };
  };

  class Element {
    constructor() { this._listeners = {}; this.value = ''; }
    addEventListener(ev, cb) { this._listeners[ev] = cb; }
    dispatchEvent(ev) { if (this._listeners[ev.type]) this._listeners[ev.type](ev); }
  }

  const selects = [0,1].map(i => {
    const e = new Element();
    e.value = `/dev/video${i}`;
    e.innerHTML = '';
    e.selectedIndex = 0;
    e.appendChild = () => {};
    return e;
  });
  const previews = [0,1].map(() => ({ src: '' }));
  const btn = new Element();
  btn.disabled = false;
  btn.textContent = '▶ Start both';
  btn.classList = { add: () => {}, remove: () => {} };

  global.document = {
    addEventListener: (ev, cb) => { if (ev === 'DOMContentLoaded') cb(); },
    querySelectorAll: (sel) => sel === '.capDev' ? selects : sel === '.prevImg' ? previews : [],
    getElementById: (id) => id === 'startAll' ? btn : null,
    createElement: () => ({ value: '', textContent: '', appendChild: () => {} }),
  };
  global.Event = class { constructor(type) { this.type = type; } };

  require(require('path').join(process.cwd(), 'video/web/static/components/live-preview.js'));

  // START recordings
  btn._listeners['click']();
  await new Promise(r => setImmediate(r));
  assert(fetchCalls[1].url.includes('/hwcapture/record?device=%2Fdev%2Fvideo0&fname=cam1.mp4'));
  assert(fetchCalls[1].opts.method === 'POST');
  assert(fetchCalls[2].url.includes('/hwcapture/record?device=%2Fdev%2Fvideo1&fname=cam2.mp4'));
  assert(fetchCalls[2].opts.method === 'POST');

  // STOP recordings
  btn._listeners['click']();
  await new Promise(r => setImmediate(r));
  assert(fetchCalls[3].url === '/hwcapture/record/job1');
  assert(fetchCalls[3].opts.method === 'DELETE');
  assert(fetchCalls[4].url === '/hwcapture/record/job2');
  assert(fetchCalls[4].opts.method === 'DELETE');
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

