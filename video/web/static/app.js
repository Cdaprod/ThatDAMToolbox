/* ----------------------------------------------------
 *  video/web/static/app.js   – polished front-end logic
 * -------------------------------------------------- */

const BASE = window.location.origin;              // e.g. http://192.168.0.22:8080
const $     = (sel, ctx = document) => ctx.querySelector(sel);

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────
async function fetchJson(url, opt = {}) {
  const res = await fetch(url, { redirect: 'follow', ...opt });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

function badge(n) {
  return `<span style="
      display:inline-block;background:var(--accent-cyan);
      color:#fff;font-size:.75rem;font-weight:600;
      padding:2px 6px;border-radius:12px;margin-left:.5rem;">
      ${n}
    </span>`;
}

// ──────────────────────────────────────────
// Batch listing & inspection
// ──────────────────────────────────────────
async function listBatches() {
  const box = $('#batches');
  if (!box) return;
  box.innerHTML = '<div class="loading">🔄 Loading batches…</div>';
  try {
    const raw = await fetchJson(`${BASE}/batches`);
    let items = [];
    if (Array.isArray(raw)) {
      items = raw;
    } else if (raw?.batches) {
      items = raw.batches;
    } else if (raw && typeof raw === 'object') {
      items = Object.keys(raw).map(k => ({ id: k, count: raw[k] }));
    }
    renderBatchList(items);
  } catch (err) {
    box.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
}

function renderBatchList(batches) {
  const box = $('#batches');
  if (!box) return;
  if (!batches.length) {
    box.innerHTML = '<div class="empty-state">📭 No batches found.</div>';
    return;
  }
  box.innerHTML = `
    <div class="batch-list">
      ${batches.map(b => {
        const id   = b.id   ?? b;
        const name = b.name ?? id;
        const cnt  = b.count ?? '';
        return `
          <button class="batch-link" onclick="inspectBatch('${id}')">
            📁 ${name} ${cnt ? badge(cnt) : ''}
          </button>`;
      }).join('')}
    </div>`;
  $('#videos').innerHTML =
    '<div class="empty-state">👆 Pick a batch to see its videos.</div>';
}

async function inspectBatch(batchId) {
  const box = $('#videos');
  if (!box) return;
  box.innerHTML = '<div class="loading">⏳ Loading videos…</div>';
  try {
    const data = await fetchJson(`${BASE}/batches/${batchId}`);
    const vids = data?.videos ?? [];
    if (!vids.length) {
      box.innerHTML = '<div class="empty-state">📭 No videos in this batch.</div>';
      return;
    }
    box.innerHTML = `
      <div class="video-title">📂 Batch: ${data.name ?? data.id}</div>
      <div class="video-grid">
        ${vids.map((v,i) => `
          <div class="video-info">
            <div class="video-title">#${i+1} 🎞️ ${v.filename ?? 'Unknown'}</div>
            <div class="video-detail">⏱️ ${v.duration ?? '--'} s</div>
            <div class="video-detail">📊 ${v.state ?? '--'}</div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    box.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
}

window.inspectBatch = inspectBatch;

// ──────────────────────────────────────────
// Motion-extraction UI
// ──────────────────────────────────────────
async function runMotionExtract(formData, resultEl, framesEl) {
  resultEl.style.display = 'block';
  resultEl.textContent = '⏳ Extracting motion frames…';
  framesEl.innerHTML     = '';
  try {
    const res = await fetchJson(`${BASE}/motion/extract`, {
      method: 'POST',
      body: formData
    });
    const frames = res.results.flatMap(r => r.frames);
    resultEl.textContent = `✅ ${frames.length} frame${frames.length !== 1 ? 's' : ''} extracted`;
    framesEl.innerHTML   = frames.map(u => `<img src="${u}" style="max-width:45%;margin:4px;">`).join('');
  } catch (err) {
    resultEl.textContent = '❌ ' + err.message;
  }
}

// ──────────────────────────────────────────
// Single preview (startPrev) & multi-preview
// ──────────────────────────────────────────
async function fillDevices() {
  const sel = $('#capDevice');
  if (!sel) return;
  const devs = await fetchJson(`${BASE}/hwcapture/devices`);
  sel.innerHTML = devs.map(d => `<option value="${d.path}">${d.path} (${d.width}×${d.height}@${d.fps|0})</option>`).join('');
}

async function initMultiPreview() {
  const devices = await fetchJson(`${BASE}/hwcapture/devices`);
  document.querySelectorAll('.capDev').forEach((sel, idx) => {
    sel.innerHTML = devices.map(d =>
      `<option value="${d.path}">${d.path} (${d.width}×${d.height})</option>`
    ).join('');
    sel.selectedIndex = idx % devices.length;
  });
}

// ──────────────────────────────────────────
// Witness-record teaser
// ──────────────────────────────────────────
async function startWitness() {
  const out = $('#witResult');
  if (!out) return;
  out.style.display = 'block';
  out.textContent = '🚀 starting…';
  try {
    const r = await fetchJson(`${BASE}/hwcapture/witness_record?duration=60`, { method: 'POST' });
    out.textContent = JSON.stringify(r, null, 2);
  } catch (e) {
    out.textContent = '❌ ' + e.message;
  }
}

// ──────────────────────────────────────────
// DOM ready: wire up all event handlers
// ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 1) Batch explorer panels & initial load
  listBatches();
  $('#refreshBatches')?.addEventListener('click', () => {
    listBatches();
    $('#videos').innerHTML = '<div class="empty-state">👆 Pick a batch to see its videos.</div>';
  });
  $('#batchExplorer')?.addEventListener('toggle', e => {
    if (e.target.open) listBatches();
  });

  // 2) Upload form
  $('#fileInput')?.addEventListener('change', e => {
    const lbl = $('#fileLabel'), n = e.target.files.length;
    lbl.textContent = n
      ? `📹 ${n} video${n>1?'s':''} selected`
      : '📁 Select Video Files';
    lbl.style.color = n ? 'var(--accent-cyan)' : 'var(--accent-blue)';
  });
  $('#uploadForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const files = $('#fileInput').files,
          out   = $('#result'),
          batch = $('input[name="batch"]').value.trim() || 'uploads';
    if (!files.length) {
      out.innerHTML = '<div class="empty-state">📂 Choose file(s) first!</div>';
      out.style.display = 'block';
      return;
    }
    const form = new FormData();
    [...files].forEach(f => form.append('files', f));
    form.append('batch', batch);
    out.style.display = 'block';
    out.innerHTML = '<div class="loading">⏳ Uploading…</div>';
    try {
      const data = await fetchJson(`${BASE}/batches/from-upload`, { method:'POST', body:form });
      out.innerHTML = `
        <details open class="upload-details">
          <summary>✅ Upload finished – click to toggle response</summary>
          <pre class="result-area">${JSON.stringify(data, null,2)}</pre>
        </details>`;
      listBatches();
    } catch(err) {
      out.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
    }
  });

  // 3) Motion extract
  $('#motionInput')?.addEventListener('change', e => {
    const lbl = $('#motionLabel'), n = e.target.files.length;
    lbl.textContent = n
      ? `📹 ${n} file${n>1?'s':''} selected`
      : '📁 Select video file(s)';
  });
  $('#motionForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const files = $('#motionInput').files;
    if (!files.length) return;
    const form = new FormData(); [...files].forEach(f => form.append('files', f));
    runMotionExtract(form, $('#motionResult'), $('#frames'));
  });

  // 4) Single preview controls
  fillDevices();
  $('#startPrev')?.addEventListener('click', () => {
    const dev = $('#capDevice').value;
    $('#previewImg').src = `${BASE}/hwcapture/stream?device=${encodeURIComponent(dev)}`;
  });

  // 5) Multi‐preview controls
  initMultiPreview();
  $('#startAll')?.addEventListener('click', () => {
    document.querySelectorAll('.grid-two div').forEach(div => {
      const dev = div.querySelector('.capDev').value;
      div.querySelector('.prevImg').src =
        `${BASE}/hwcapture/stream?device=${encodeURIComponent(dev)}&width=640&height=360`;
    });
  });

  // 6) Witness teaser
  $('#startWitness')?.addEventListener('click', startWitness);

  // 7) BURGER & SIDEBAR toggle
  const burger = $('#burger'), sidebar = $('#sidebar');
  if (burger && sidebar) {
    burger.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  // 8) NAV‐LIST smooth scroll & active state
  document.querySelectorAll('.nav-list button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-list button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.target);
      target?.scrollIntoView({ behavior:'smooth', block:'start' });
      sidebar?.classList.remove('open');
    });
  });

  // 9) HOT-PLUG cameras: re-scan on preview-card open
  $('#previewCard')?.addEventListener('toggle', e => {
    if (e.target.open) initMultiPreview();
  });
});