/* ------------------------------------------------------------------
 * explorer.js  –  combines
 *   • <explorer-pane>  (rich grid of <video-card>)
 *   • ExplorerCard     (JSON tree inside "glass-card" widget)
 * ------------------------------------------------------------------ */

import { renderObject } from './object-renderer.js';

/* ╭──────────────────────────────────────────────────────────────╮
   │  1) <explorer-pane>  – custom element                        │
   ╰──────────────────────────────────────────────────────────────╯ */
export class ExplorerPane extends HTMLElement {
  constructor () {
    super();
    const root = this.attachShadow({mode: 'open'});
    root.innerHTML = `
      <style>
        :host {display:block;}
        header{display:flex;justify-content:space-between;align-items:center;margin:0 0 1rem;}
        #grid {display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));}
        #empty{color:#666;}
      </style>
      <header>
        <h2 id="title">Explorer</h2>
        <button id="refresh" class="btn btn-small">⟳ Refresh</button>
      </header>
      <div id="grid"></div>
      <p id="empty" hidden>(No items)</p>`;
    this.$ = sel => root.querySelector(sel);
    this.$('#refresh').onclick = () => this.refresh();
  }

  static get observedAttributes() { return ['batch-id','limit']; }
  attributeChangedCallback () { if (this.isConnected) this.refresh(); }
  connectedCallback () { this.refresh(); }

  async refresh () {
    const bid   = this.getAttribute('batch-id');
    const limit = this.getAttribute('limit') || 50;
    const url   = bid
      ? `/api/v1/explorer/batch/${encodeURIComponent(bid)}`
      : `/api/v1/explorer?limit=${limit}`;

    this.$('#grid').innerHTML = '';
    this.$('#empty').hidden   = true;
    this.$('#title').textContent = bid ? `Batch ${bid}` : 'Explorer';

    try {
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      const items = bid ? json.artifacts ?? [] : json.items ?? [];

      if (!items.length) { this.$('#empty').hidden = false; return; }

      for (const art of items) {
        const card = document.createElement('video-card');
        card.data  = art;                // <video-card> handles its own render
        this.$('#grid').appendChild(card);
      }
    } catch (err) {
      console.error('[explorer]', err);
      this.$('#title').textContent = 'Explorer – error';
      this.$('#empty').textContent = 'Failed to load data';
      this.$('#empty').hidden      = false;
    }
  }
}
if (!customElements.get('explorer-pane')) {
  customElements.define('explorer-pane', ExplorerPane);
}

/* ╭──────────────────────────────────────────────────────────────╮
   │  2) ExplorerCard – controller for the dashboard "glass-card" │
   ╰──────────────────────────────────────────────────────────────╯ */
class ExplorerCard {
  constructor () {
    this.card   = document.getElementById('explorerCard');
    if (!this.card) {                      // card not on this page? bail.
      console.warn('[explorer] #explorerCard not found');
      return;
    }
    this.tree   = this.card.querySelector('#explorer-tree');
    this.refreshBtn = this.card.querySelector('#explorer-refresh');
    this.refreshBtn.onclick = () => this.load();
    this.load();
  }

  async load () {
    this.tree.textContent = '⏳ Loading…';
    try {
      const res  = await fetch('/api/v1/explorer?limit=100');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      this.tree.innerHTML = '';
      this.tree.appendChild(renderObject(data, { collapsed: 1 }));
    } catch (err) {
      console.error('[explorer]', err);
      this.tree.innerHTML =
        `<span style="color:#f66;">Failed: ${err.message}</span>`;
    }
  }
}

/* ------------------------------------------------------------------
 * 3) Kick-off: instantiate ExplorerCard when DOM is ready
 *    (ExplorerPane auto-starts on its own)
 * ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => new ExplorerCard());

/* ------------------------------------------------------------------
 * Default export = ExplorerCard  (so app.js `import ExplorerCard …`
 * continues to work).  ExplorerPane is a named export (see top).
 * ------------------------------------------------------------------ */
export default ExplorerCard;