/* upload-card.js – replaces old inline <script> */

export default class UploadCard {
  constructor () {
    this.card   = document.getElementById('uploadCard');
    this.input  = this.card.querySelector('#file-input');
    this.list   = this.card.querySelector('#upload-list');
    this.input.onchange = () => this.handleFiles(this.input.files);
  }

  handleFiles (files) {
    [...files].forEach(f => this.sendFile(f));
    this.input.value = '';                 // allow re-select same file later
  }

  async sendFile (file) {
    const li = document.createElement('li');
    li.textContent = `${file.name} – 0 %`;
    this.list.appendChild(li);

    const body = new FormData();
    body.append('file', file);

    const r = await fetch('/api/v1/upload', { method:'POST', body });
    if (!r.ok) { li.textContent = `${file.name} – failed`; return; }

    const { job_id } = await r.json();
    this.poll(job_id, li);
  }

  /* poll until backend marks job done -------------------------- */
  async poll (id, el) {
    const poll = setInterval(async () => {
      const r = await fetch(`/api/v1/upload/${id}`);
      if (!r.ok) { el.textContent += ' (lost)'; clearInterval(poll); return; }
      const j = await r.json();
      el.textContent = `${j.filename} – ${Math.round(j.progress*100)} %`;
      if (j.status === 'done') {
        clearInterval(poll);
        el.textContent = `${j.filename} – ✅`;
        // make Explorer reload so new video pops in
        document.querySelector('explorer-pane')?.refresh();
      } else if (j.status === 'error') {
        clearInterval(poll);
        el.textContent = `${j.filename} – ❌ ${j.error}`;
      }
    }, 1500);
  }
}

document.addEventListener('DOMContentLoaded', () => new UploadCard());