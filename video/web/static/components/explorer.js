/* ------------------------------------------------------------
 * <explorer-pane>  –  primary discovery grid for the DAM UI
 *
 * Usage examples
 *   <!-- 1) Recent feed (default limit=50) -->
 *   <explorer-pane></explorer-pane>
 *
 *   <!-- 2) Show a specific batch -->
 *   <explorer-pane batch-id="abcd-1234"></explorer-pane>
 *
 *   <!-- 3) Reload programmatically -->
 *   document.querySelector('explorer-pane').refresh()
 * ---------------------------------------------------------- */

export class ExplorerPane extends HTMLElement {
  constructor () {
    super()
    // simple shadow DOM so host-page styles still apply
    this.attachShadow({ mode: 'open' })
      .innerHTML = `
        <style>
          :host { display:block; }
          header {
            display:flex; justify-content:space-between; align-items:center;
            margin:0 0 1rem;
          }
          #grid {
            display:grid;
            gap:1rem;
            grid-template-columns: repeat(auto-fill,minmax(240px,1fr));
          }
        </style>

        <header>
          <h2 id="title">Explorer</h2>
          <button id="refresh" class="btn btn-small">⟳ Refresh</button>
        </header>

        <div id="grid"></div>

        <p id="empty" style="display:none;color:#666;">(No items)</p>
      `
    this._grid   = this.shadowRoot.getElementById('grid')
    this._title  = this.shadowRoot.getElementById('title')
    this._empty  = this.shadowRoot.getElementById('empty')
    this.shadowRoot.getElementById('refresh')
        .addEventListener('click', () => this.refresh())
  }

  /* ---------- lifecycle ---------- */
  connectedCallback () { this.refresh() }

  static get observedAttributes () { return ['batch-id'] }
  attributeChangedCallback () { this.refresh() }

  /* ---------- public API ---------- */
  async refresh () {
    this._grid.innerHTML = ''                    // clear grid
    const batchId = this.getAttribute('batch-id')
    try {
      const url   = batchId
        ? `/explorer/batch/${encodeURIComponent(batchId)}`
        : `/explorer?limit=${this.getAttribute('limit') || 50}`
      const res   = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data  = await res.json()

      const items = batchId ? data.artifacts ?? [] : data.items ?? []
      this._title.textContent = batchId
        ? `Batch ${batchId}`
        : 'Recent Media'

      if (!items.length) {
        this._empty.style.display = ''
        return
      } else {
        this._empty.style.display = 'none'
      }

      // Render each artifact via existing <video-card>
      for (const art of items) {
        const card = document.createElement('video-card')
        // assume video-card.js exposes a .data property
        card.data = art
        this._grid.appendChild(card)
      }
    } catch (err) {
      console.error('[explorer] failed to load', err)
      this._title.textContent = 'Explorer – error'
      this._empty.textContent = 'Failed to load data'
      this._empty.style.display = ''
    }
  }
}

/* Register the custom element (safe if loaded twice) */
if (!customElements.get('explorer-pane')) {
  customElements.define('explorer-pane', ExplorerPane)
}