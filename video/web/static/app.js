/* ----------------------------------------------------
 *  Extensible Video App Architecture
 * -------------------------------------------------- */

// ──────────────────────────────────────────
// Core Infrastructure
// ──────────────────────────────────────────

// Event System for loose coupling
class EventBus {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }

  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }
}

// Configuration management
class Config {
  constructor() {
    this.settings = {
      baseUrl: window.location.origin,
      endpoints: {
        batches: '/batches',
        upload: '/batches/from-upload',
        motion: '/motion/extract',
        devices: '/hwcapture/devices',
        stream: '/hwcapture/stream',
        witness: '/hwcapture/witness_record'
      },
      ui: {
        loadingMessages: {
          batches: 'Loading batches...',
          upload: 'Uploading...',
          motion: 'Extracting motion frames...',
          witness: 'Starting witness recording...'
        }
      }
    };
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.settings);
  }

  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => obj[key] = obj[key] || {}, this.settings);
    target[lastKey] = value;
  }
}

// Plugin system for extensibility
class PluginManager {
  constructor(eventBus) {
    this.plugins = new Map();
    this.eventBus = eventBus;
  }

  register(name, plugin) {
    if (this.plugins.has(name)) {
      throw new Error(`Plugin ${name} already registered`);
    }
    
    this.plugins.set(name, plugin);
    
    // Initialize plugin if it has an init method
    if (typeof plugin.init === 'function') {
      plugin.init(this.eventBus);
    }
    
    this.eventBus.emit('plugin:registered', { name, plugin });
  }

  get(name) {
    return this.plugins.get(name);
  }

  unregister(name) {
    const plugin = this.plugins.get(name);
    if (plugin && typeof plugin.destroy === 'function') {
      plugin.destroy();
    }
    this.plugins.delete(name);
  }

  getAll() {
    return Array.from(this.plugins.entries());
  }
}

// ──────────────────────────────────────────
// Base Classes for Extension
// ──────────────────────────────────────────

// Abstract base manager class
class BaseManager {
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Override in subclasses
  }

  async fetchJson(url, options = {}) {
    try {
      const response = await fetch(url, { redirect: 'follow', ...options });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      console.error('Fetch error:', error);
      this.eventBus.emit('error', { source: this.constructor.name, error });
      throw error;
    }
  }

  $(selector, context = document) {
    return context.querySelector(selector);
  }
}

// Base UI component class
class BaseComponent {
  constructor(element, eventBus, config) {
    this.element = element;
    this.eventBus = eventBus;
    this.config = config;
    this.state = {};
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Override in subclasses
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  render() {
    // Override in subclasses
  }

  destroy() {
    // Cleanup logic
  }
}

// ──────────────────────────────────────────
// Refactored Managers with Extension Points
// ──────────────────────────────────────────

class BatchManager extends BaseManager {
  constructor(eventBus, config) {
    super(eventBus, config);
    this.parsers = new Map();
    this.renderers = new Map();
    
    // Register default parsers and renderers
    this.registerParser('default', this.defaultParser.bind(this));
    this.registerRenderer('default', this.defaultRenderer.bind(this));
  }

  setupEventListeners() {
    this.eventBus.on('batch:refresh', () => this.loadBatches());
    this.eventBus.on('batch:inspect', ({ batchId }) => this.inspectBatch(batchId));
  }

  // Extension point: custom parsers
  registerParser(name, parser) {
    this.parsers.set(name, parser);
  }

  // Extension point: custom renderers
  registerRenderer(name, renderer) {
    this.renderers.set(name, renderer);
  }

  async loadBatches() {
    const batchContainer = this.$('#batches');
    if (!batchContainer) return;

    this.showLoading(batchContainer, this.config.get('ui.loadingMessages.batches'));

    try {
      const response = await this.fetchJson(`${this.config.get('baseUrl')}${this.config.get('endpoints.batches')}`);
      const batches = this.parseBatchResponse(response);
      this.renderBatchList(batches);
      this.eventBus.emit('batch:loaded', { batches });
    } catch (error) {
      this.showError(batchContainer, error.message);
    }
  }

  parseBatchResponse(response, parserName = 'default') {
    const parser = this.parsers.get(parserName);
    if (!parser) {
      throw new Error(`Parser ${parserName} not found`);
    }
    return parser(response);
  }

  defaultParser(response) {
    if (Array.isArray(response)) return response;
    if (response?.batches) return response.batches;
    if (response && typeof response === 'object') {
      return Object.keys(response).map(key => ({
        id: key,
        batch: key,
        count: response[key]
      }));
    }
    return [];
  }

  renderBatchList(batches, rendererName = 'default') {
    const renderer = this.renderers.get(rendererName);
    if (!renderer) {
      throw new Error(`Renderer ${rendererName} not found`);
    }
    renderer(batches);
  }

  defaultRenderer(batches) {
    const batchContainer = this.$('#batches');
    if (!batchContainer) return;

    if (!batches.length) {
      this.showEmpty(batchContainer, '📭 No batches found.');
      return;
    }

    batchContainer.innerHTML = batches.map(batch => `
      <button class="batch-link" data-batch="${batch.batch}">
        📁 ${batch.batch} ${this.createBadge(batch.count)}
      </button>
    `).join('');

    this.attachBatchClickHandlers();
  }

  createBadge(count) {
    return `<span style="
      display: inline-block;
      background: var(--accent-cyan);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 12px;
      margin-left: 0.5rem;
    ">${count}</span>`;
  }

  attachBatchClickHandlers() {
    this.$('#batches')?.querySelectorAll('.batch-link').forEach(button => {
      button.addEventListener('click', () => {
        const batchName = button.dataset.batch;
        this.eventBus.emit('batch:selected', { batchName });
        this.inspectBatch(batchName);
      });
    });
  }

  inspectBatch(batchId) {
    const videoContainer = this.$('#videos');
    if (!videoContainer) return;

    videoContainer.innerHTML = '';
    const batchCard = document.createElement('batch-card');
    batchCard.setAttribute('batch-id', batchId);
    videoContainer.appendChild(batchCard);
    
    this.eventBus.emit('batch:inspected', { batchId });
  }

  showLoading(element, message) {
    if (element) {
      element.innerHTML = `<div class="loading">🔄 ${message}</div>`;
    }
  }

  showError(element, message) {
    if (element) {
      element.innerHTML = `<div class="empty-state">❌ ${message}</div>`;
    }
  }

  showEmpty(element, message) {
    if (element) {
      element.innerHTML = `<div class="empty-state">${message}</div>`;
    }
  }
}

class UploadManager extends BaseManager {
  constructor(eventBus, config) {
    super(eventBus, config);
    this.validators = new Map();
    this.processors = new Map();
    
    // Register default validator and processor
    this.registerValidator('default', this.defaultValidator.bind(this));
    this.registerProcessor('default', this.defaultProcessor.bind(this));
  }

  setupEventListeners() {
    this.eventBus.on('upload:start', (data) => this.handleUpload(data));
    this.eventBus.on('upload:complete', () => this.eventBus.emit('batch:refresh'));
  }

  // Extension point: custom validators
  registerValidator(name, validator) {
    this.validators.set(name, validator);
  }

  // Extension point: custom processors
  registerProcessor(name, processor) {
    this.processors.set(name, processor);
  }

  async handleUpload(data, validatorName = 'default', processorName = 'default') {
    const validator = this.validators.get(validatorName);
    const processor = this.processors.get(processorName);

    if (!validator || !processor) {
      throw new Error('Invalid validator or processor');
    }

    const validation = validator(data);
    if (!validation.isValid) {
      this.eventBus.emit('upload:error', { error: validation.error });
      return;
    }

    try {
      const result = await processor(data);
      this.eventBus.emit('upload:complete', { result });
    } catch (error) {
      this.eventBus.emit('upload:error', { error });
    }
  }

  defaultValidator(data) {
    if (!data.files || !data.files.length) {
      return { isValid: false, error: 'No files selected' };
    }
    return { isValid: true };
  }

  async defaultProcessor(data) {
    const formData = new FormData();
    Array.from(data.files).forEach(file => formData.append('files', file));
    formData.append('batch', data.batchName || 'uploads');

    return await this.fetchJson(`${this.config.get('baseUrl')}${this.config.get('endpoints.upload')}`, {
      method: 'POST',
      body: formData
    });
  }
}

// ──────────────────────────────────────────
// Plugin Examples
// ──────────────────────────────────────────

// Analytics plugin
class AnalyticsPlugin {
  init(eventBus) {
    this.eventBus = eventBus;
    this.setupTracking();
  }

  setupTracking() {
    this.eventBus.on('batch:selected', (data) => {
      this.track('batch_selected', data);
    });
    
    this.eventBus.on('upload:complete', (data) => {
      this.track('upload_complete', data);
    });
  }

  track(event, data) {
    console.log('Analytics:', event, data);
    // Send to analytics service
  }

  destroy() {
    // Cleanup
  }
}

// Theme plugin
class ThemePlugin {
  init(eventBus) {
    this.eventBus = eventBus;
    this.themes = new Map();
    this.registerTheme('dark', this.darkTheme);
    this.registerTheme('light', this.lightTheme);
  }

  registerTheme(name, theme) {
    this.themes.set(name, theme);
  }

  applyTheme(name) {
    const theme = this.themes.get(name);
    if (theme) {
      Object.entries(theme).forEach(([property, value]) => {
        document.documentElement.style.setProperty(property, value);
      });
      this.eventBus.emit('theme:changed', { name });
    }
  }

  get darkTheme() {
    return {
      '--bg-color': '#1a1a1a',
      '--text-color': '#ffffff',
      '--accent-cyan': '#00d4ff'
    };
  }

  get lightTheme() {
    return {
      '--bg-color': '#ffffff',
      '--text-color': '#000000',
      '--accent-cyan': '#0066cc'
    };
  }
}

// ──────────────────────────────────────────
// Application Factory
// ──────────────────────────────────────────

class AppFactory {
  static create(plugins = []) {
    const eventBus = new EventBus();
    const config = new Config();
    const pluginManager = new PluginManager(eventBus);
    
    // Register core managers
    const batchManager = new BatchManager(eventBus, config);
    const uploadManager = new UploadManager(eventBus, config);
    
    // Register plugins
    plugins.forEach(plugin => {
      pluginManager.register(plugin.name, plugin.instance);
    });
    
    return {
      eventBus,
      config,
      pluginManager,
      managers: {
        batch: batchManager,
        upload: uploadManager
      }
    };
  }
}

// ──────────────────────────────────────────
// Usage Example
// ──────────────────────────────────────────

// Create app with plugins
const app = AppFactory.create([
  { name: 'analytics', instance: new AnalyticsPlugin() },
  { name: 'theme', instance: new ThemePlugin() }
]);

// Extend batch manager with custom parser
app.managers.batch.registerParser('custom', (response) => {
  // Custom parsing logic
  return response.data?.items || [];
});

// Add custom upload processor
app.managers.upload.registerProcessor('s3', async (data) => {
  // Custom S3 upload logic
  const s3Response = await uploadToS3(data);
  return s3Response;
});

// Listen to events
app.eventBus.on('batch:selected', (data) => {
  console.log('Batch selected:', data.batchName);
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  app.managers.batch.loadBatches();
  
  // Apply theme
  const themePlugin = app.pluginManager.get('theme');
  themePlugin.applyTheme('dark');
});

// export { AppFactory, BaseManager, BaseComponent, AnalyticsPlugin, ThemePlugin };

// Temporary shim so buttons still work
window.listBatches  = () => app.managers.batch.loadBatches();
window.inspectBatch = id => app.eventBus.emit('batch:inspect', { batchId: id });

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

// wire sidebar buttons → panel toggle
document.addEventListener('DOMContentLoaded', () => {
  const panels = document.querySelectorAll('.tab-panel');
  document.querySelectorAll('.nav-list button').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      // activate matching panel, deactivate others
      panels.forEach(sec => {
        sec.classList.toggle('active', sec.id === target);
      });
      // sync button highlight
      document.querySelectorAll('.nav-list button')
        .forEach(b => b.classList.toggle('active', b === btn));
    });
  });
});

// ──────────────────────────────────────────
// Batch listing & inspection
// ──────────────────────────────────────────
function renderBatchList(items) {
  const box = $('#batchList');
  if (!box) return;

  // 1) Empty state
  if (!items.length) {
    box.innerHTML = '<div class="empty-state">📭 No batches found.</div>';
    return;
  }

  // 2) Build buttons with a data-batch attribute
  box.innerHTML = items.map(item => `
    <button class="batch-link" data-batch="${item.batch}">
      📁 ${item.batch} ${badge(item.count)}
    </button>
  `).join('');

  // 3) Attach click handlers to each button
  box.querySelectorAll('.batch-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const batchName = btn.dataset.batch; 
      console.log('Clicked batch:', batchName);
      inspectBatch(batchName);
    });
  });
}

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

// async function inspectBatch(batchId) {
//   const box = $('#videos');
//   box.innerHTML = '<div class="loading">⏳ Loading videos…</div>';

//   try {
//     const data = await fetchJson(`${BASE}/batches/${batchId}`);
//     console.log('Batch data:', data);  // <-- Add this line!

//     const vids = data?.videos ?? [];

//     if (!vids.length) {
//       box.innerHTML = '<div class="empty-state">📭 No videos in this batch.</div>';
//       return;
//     }

//     box.innerHTML = `
//       <div class="video-title">📂 Batch: ${data.name ?? data.id ?? batchId}</div>
//       <div class="video-grid">
//         ${vids.map((v,i) => `
//           <div class="video-info">
//             <div class="video-title">#${i+1} 🎞️ ${v.filename ?? 'Unknown'}</div>
//             <div class="video-detail">⏱️ ${v.duration ?? '--'} s</div>
//             <div class="video-detail">📊 ${v.state   ?? '--'}</div>
//           </div>`).join('')}
//       </div>`;
//   } catch (err) {
//     box.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
//   }
// }

function inspectBatch(batchId) {
  const box = $('#videos');
  box.innerHTML = '';                  // clear out any prior content
  const card = document.createElement('batch-card');
  card.setAttribute('batch-id', batchId);
  box.append(card);
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