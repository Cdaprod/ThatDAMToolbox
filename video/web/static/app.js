/* ----------------------------------------------------
 *  video/web/static/app.js
 * -------------------------------------------------- */

const BASE = window.location.origin;     // → http://192.168.0.22:8080

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
async function fetchJson(url, options = {}) {
  const res = await fetch(url, {redirect: "follow", ...options});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const txt = await res.text();          // never throws on empty body
  return txt ? JSON.parse(txt) : null;
}

function $(sel) { return document.querySelector(sel); }

// ──────────────────────────────────────────────────────────
// UI – file picker feedback
// ──────────────────────────────────────────────────────────
$('#fileInput').addEventListener('change', e => {
  const lbl   = $('#fileLabel');
  const files = e.target.files;
  if (files.length) {
    lbl.textContent = `📹  ${files.length} video${files.length > 1 ? 's' : ''} selected`;
    lbl.style.color = '#26c6da';
  } else {
    lbl.textContent = '📁  Select Video Files';
    lbl.style.color = '#64b5f6';
  }
});

// ──────────────────────────────────────────────────────────
// Upload
// ──────────────────────────────────────────────────────────
$('#uploadForm').onsubmit = async e => {
  e.preventDefault();

  const files = $('#fileInput').files;
  const batch = $('input[name="batch"]').value || 'uploads';
  const out   = $('#result');

  if (!files.length) {
    out.style.display = 'block';
    out.textContent   = 'Please select one or more video files.';
    return;
  }

  const form = new FormData();
  [...files].forEach(f => form.append('files', f));
  form.append('batch', batch);

  out.style.display = 'block';
  out.textContent   = '⏳ Uploading…';

  try {
    const data = await fetchJson(`${BASE}/batches/from-upload`, {
      method: 'POST',
      body  : form
    });
    out.textContent = '✅ Upload Result:\n' + JSON.stringify(data, null, 2);
    listBatches();                       // refresh
  } catch (err) {
    out.textContent = '❌ Upload failed: ' + err.message;
  }
};

// ──────────────────────────────────────────────────────────
// Batches
// ──────────────────────────────────────────────────────────
async function listBatches() {
  const box = $('#batches');
  box.innerHTML = '<div class="loading">🔄 Loading batches…</div>';

  try {
    const data    = await fetchJson(`${BASE}/batches`);
    const batches = Array.isArray(data) ? data
                                        : (data?.batches || []);
    displayBatchList(batches);
  } catch (err) {
    box.innerHTML = '<div class="empty-state">❌ Failed to load batches</div>';
  }
}

function displayBatchList(batches) {
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
          return `<div class="batch-link" onclick="inspectBatch('${id}')">📁 ${name}</div>`;
      }).join('')}
    </div>`;

  $('#videos').innerHTML =
      '<div class="empty-state">👆 Select a batch above to view its videos.</div>';
}

// ──────────────────────────────────────────────────────────
// Inspect one batch
// ──────────────────────────────────────────────────────────
async function inspectBatch(batchId) {
  const box = $('#videos');
  box.innerHTML = '<div class="loading">⏳ Loading videos…</div>';

  try {
    const data = await fetchJson(`${BASE}/batches/${batchId}`);
    if (data?.videos?.length) {
      box.innerHTML = `
        <div class="video-title">📂 Batch: ${data.name ?? data.id}</div>
        ${data.videos.map((v,i) => `
          <div class="video-info">
            <div class="video-title">#${i+1} 🎬</div>
            <div class="video-detail">📄 File: ${v.filename ?? v.file_path ?? 'Unknown'}</div>
            <div class="video-detail">⏱️ Duration: ${v.duration ?? 'N/A'}</div>
            <div class="video-detail">📊 State: ${v.state ?? 'N/A'}</div>
          </div>`).join('')}
      `;
    } else {
      box.innerHTML = '<div class="empty-state">📭 No videos in this batch.</div>';
    }
  } catch (err) {
    box.innerHTML = '<div class="empty-state">❌ Failed to load batch videos</div>';
  }
}

// make function available to `onclick` inline handler
window.inspectBatch = inspectBatch;

// initial load
listBatches();