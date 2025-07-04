/* ----------------------------------------------------
 *  video/web/static/app.js   – polished front-end logic
 * -------------------------------------------------- */

const BASE = window.location.origin;              // e.g. http://192.168.0.22:8080
const $     = (sel, ctx = document) => ctx.querySelector(sel);

/* small helpers ----------------------------------------------------------- */
async function fetchJson(url, opt = {}) {
  const res = await fetch(url, { redirect: 'follow', ...opt });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

function badge(n) {
  return `<span style="
      display:inline-block;background:#26c6da;
      color:#fff;font-size:.75rem;font-weight:600;
      padding:2px 6px;border-radius:12px;margin-left:.5rem;">
      ${n}
    </span>`;
}

/* file-picker feedback ---------------------------------------------------- */
$('#fileInput').addEventListener('change', e => {
  const lbl   = $('#fileLabel');
  const n     = e.target.files.length;
  lbl.textContent = n
      ? `📹 ${n} video${n > 1 ? 's' : ''} selected`
      : '📁 Select Video Files';
  lbl.style.color = n ? '#26c6da' : '#64b5f6';
});

/* upload ------------------------------------------------------------------ */
$('#uploadForm').onsubmit = async e => {
  e.preventDefault();

  const files = $('#fileInput').files;
  const batch = $('input[name="batch"]').value.trim() || 'uploads';
  const out   = $('#result');

  if (!files.length) {
    out.innerHTML = '<div class="empty-state">📂 Choose file(s) first!</div>';
    out.style.display = 'block';
    return;
  }

  const form = new FormData();
  [...files].forEach(f => form.append('files', f));
  form.append('batch', batch);

  out.style.display = 'block';
  out.innerHTML     = '<div class="loading">⏳ Uploading…</div>';

  try {
    const data = await fetchJson(`${BASE}/batches/from-upload`, {
      method: 'POST',
      body  : form
    });

    /* pretty accordion ----------------------------------------------- */
    out.innerHTML = `
      <details open class="upload-details">
        <summary>✅ Upload finished – click to toggle response</summary>
        <pre class="result-area">${JSON.stringify(data, null, 2)}</pre>
      </details>`;
    listBatches();                                       // refresh side-panel
  } catch (err) {
    out.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
};

/* batches ----------------------------------------------------------------- */
async function listBatches() {
  const box = $('#batches');
  box.innerHTML = '<div class="loading">🔄 Loading batches…</div>';

  try {
    const raw = await fetchJson(`${BASE}/batches`);

    /* accept every historical shape ----------------------------------- */
    let items = [];
    if (Array.isArray(raw)) {
      items = raw;                                       // new API
    } else if (raw?.batches) {
      items = raw.batches;                               // old wrapper
    } else if (raw && typeof raw === 'object') {
      // dict name → count from CLI
      items = Object.keys(raw).map(k => ({ id: k, count: raw[k] }));
    }

    renderBatchList(items);
  } catch (err) {
    box.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
}

function renderBatchList(batches) {
  const box = $('#batches');
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
          <button class="batch-link"
                  onclick="inspectBatch('${id}')">
            📁 ${name} ${cnt ? badge(cnt) : ''}
          </button>`;}).join('')}
    </div>`;
  $('#videos').innerHTML =
      '<div class="empty-state">👆 Pick a batch to see its videos.</div>';
}

/* inspect one batch ------------------------------------------------------- */
async function inspectBatch(batchId) {
  const box = $('#videos');
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
            <div class="video-detail">📊 ${v.state   ?? '--'}</div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    box.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
}

/* make inspector callable from inline onclick ---------------------------- */
window.inspectBatch = inspectBatch;

/* first load ------------------------------------------------------------- */
listBatches();