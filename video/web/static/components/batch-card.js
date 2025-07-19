//  * video/web/static/components/batch-card.js

import '/static/components/object-renderer.js';
import Ajv from 'https://cdn.skypack.dev/ajv';
import schema from '/static/schema/v1/media-batch.json' assert { type: 'json' };

const ajv = new Ajv({ strict: false });
const validate = ajv.compile(schema);

class BatchCard extends HTMLElement {
  async connectedCallback() {
    const id = this.getAttribute('batch-id');
    if (!id) return this.textContent = '⚠️ No batch-id set';

    let data;
    try {
      const res = await fetch(`/batches/${id}`);
      data = await res.json();
    } catch (e) {
      return this.textContent = `❌ Fetch error: ${e.message}`;
    }

    if (!validate(data)) {
      console.warn('Batch schema errors:', validate.errors);
      return this.textContent = '❌ Invalid batch data';
    }

    // --- known fields first ---
    const title = document.createElement('h2');
    title.textContent = data.name || data.id;
    const info = document.createElement('p');
    const count = Array.isArray(data.items) ? data.items.length : '?';
    info.innerHTML = `${count} file${count===1?'':'s'} -- created ${data.created_at}`;

    // --- generic fallback renderer ---
    const tree = document.createElement('object-renderer');
    tree.data = data;

    this.replaceChildren(title, info, tree);
  }
}
customElements.define('batch-card', BatchCard);