// Adjust base URL as needed
const BASE = location.origin;

// File input feedback
document.getElementById('fileInput').addEventListener('change', function(e) {
  const label = document.getElementById('fileLabel');
  const files = e.target.files;
  if (files.length > 0) {
    label.textContent = `📹 ${files.length} video${files.length > 1 ? 's' : ''} selected`;
    label.style.color = '#26c6da';
  } else {
    label.textContent = '📁 Select Video Files';
    label.style.color = '#64b5f6';
  }
});

// Handle Upload
document.getElementById('uploadForm').onsubmit = async (e) => {
  e.preventDefault();
  const files = document.querySelector('input[type="file"]').files;
  const batch = document.querySelector('input[name="batch"]').value || "uploads";
  const resultDiv = document.getElementById('result');
  
  if (!files.length) {
    resultDiv.style.display = 'block';
    resultDiv.textContent = "Please select one or more video files.";
    return;
  }
  
  const form = new FormData();
  for (const file of files) form.append('files', file);
  form.append('batch', batch);

  resultDiv.style.display = 'block';
  resultDiv.textContent = "⏳ Uploading...";
  
  try {
    const res = await fetch(`${BASE}/batches/from-upload/`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    resultDiv.textContent = "✅ Upload Result:\n" + JSON.stringify(data, null, 2);
    listBatches(); // Refresh batches after upload
  } catch (error) {
    resultDiv.textContent = "❌ Upload failed: " + error.message;
  }
};

// List Batches
async function listBatches() {
  const batchesDiv = document.getElementById('batches');
  batchesDiv.innerHTML = '<div class="loading">🔄 Loading batches...</div>';
  
  try {
    const res = await fetch(`${BASE}/batches/`);
    const batches = await res.json();
    if (!Array.isArray(batches) && batches.batches) {
      displayBatchList(batches.batches);
    } else {
      displayBatchList(batches);
    }
  } catch (error) {
    batchesDiv.innerHTML = '<div class="empty-state">❌ Failed to load batches</div>';
  }
}

function displayBatchList(batches) {
  const batchesDiv = document.getElementById('batches');
  if (!batches.length) {
    batchesDiv.innerHTML = '<div class="empty-state">📭 No batches found.</div>';
    return;
  }
  
  const batchLinks = batches.map(batch => {
    const batchId = batch.id || batch;
    const batchName = batch.name || batch.id || batch;
    return `<div class="batch-link" onclick="inspectBatch('${batchId}')">📁 ${batchName}</div>`;
  }).join('');
  
  batchesDiv.innerHTML = `<div class="batch-list">${batchLinks}</div>`;
  document.getElementById('videos').innerHTML = '<div class="empty-state">👆 Select a batch above to view its videos.</div>';
}

// Inspect a single batch's videos
async function inspectBatch(batchId) {
  const videosDiv = document.getElementById('videos');
  videosDiv.innerHTML = '<div class="loading">⏳ Loading videos...</div>';
  
  try {
    const res = await fetch(`${BASE}/batches/${batchId}/`);
    const data = await res.json();
    
    if (data.videos && data.videos.length > 0) {
      let html = `<div class="video-title">📂 Batch: ${data.name || data.id}</div>`;
      
      data.videos.forEach((v, i) => {
        html += `
          <div class="video-info">
            <div class="video-title">#${i + 1} 🎬</div>
            <div class="video-detail">📄 File: ${v.filename || v.file_path || 'Unknown'}</div>
            <div class="video-detail">⏱️ Duration: ${v.duration ? v.duration + 's' : 'N/A'}</div>
            <div class="video-detail">📊 State: ${v.state || 'N/A'}</div>
          </div>
        `;
      });
      
      videosDiv.innerHTML = html;
    } else if (data.videos && data.videos.length === 0) {
      videosDiv.innerHTML = '<div class="empty-state">📭 No videos in this batch.</div>';
    } else {
      videosDiv.innerHTML = `<div class="result-area">${JSON.stringify(data, null, 2)}</div>`;
    }
  } catch (error) {
    videosDiv.innerHTML = '<div class="empty-state">❌ Failed to load batch videos</div>';
  }
}

// List batches on load
listBatches();

// Expose inspectBatch for HTML onclick
window.inspectBatch = inspectBatch;