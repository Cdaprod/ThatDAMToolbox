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

export { AppFactory, BaseManager, BaseComponent, AnalyticsPlugin, ThemePlugin };