// /js/upload-card.js

export default class UploadCard {
  constructor() {
    this.card = document.getElementById('uploadCard');
    if (!this.card) throw new Error('UploadCard: #uploadCard not found in DOM');
    this.input = this.card.querySelector('#file-input');
    this.list = this.card.querySelector('#upload-list');
    if (!this.input || !this.list) throw new Error('UploadCard: required elements not found');
    this.input.addEventListener('change', () => this.handleFiles(this.input.files));
  }

  handleFiles(files) {
    if (!files || !files.length) return;
    [...files].forEach(file => this.sendFile(file));
    this.input.value = ''; // Reset input so same file can be selected again
  }

  async sendFile(file) {
    const li = document.createElement('li');
    li.textContent = `${file.name} – 0 %`;
    this.list.appendChild(li);

    const form = new FormData();
    form.append('file', file);

    try {
      const resp = await fetch('/api/v1/upload', { method: 'POST', body: form });
      if (!resp.ok) {
        li.textContent = `${file.name} – failed`;
        return;
      }
      const { job_id } = await resp.json();
      this.poll(job_id, li);
    } catch (e) {
      li.textContent = `${file.name} – network error`;
    }
  }

  async poll(job_id, li) {
    const pollInterval = 1500;
    let timer = setInterval(async () => {
      try {
        const resp = await fetch(`/api/v1/upload/${job_id}`);
        if (!resp.ok) {
          li.textContent += ' (lost)';
          clearInterval(timer);
          return;
        }
        const j = await resp.json();
        li.textContent = `${j.filename} – ${Math.round(j.progress * 100)} %`;
        if (j.status === 'done') {
          clearInterval(timer);
          li.textContent = `${j.filename} – ✅`;
          // Notify DAM Explorer to refresh its asset list
          window.dispatchEvent(new Event('explorer:refresh'));
        } else if (j.status === 'error') {
          clearInterval(timer);
          li.textContent = `${j.filename} – ❌ ${j.error || 'Unknown error'}`;
        }
      } catch (e) {
        li.textContent += ' (error)';
        clearInterval(timer);
      }
    }, pollInterval);
  }
}

document.addEventListener('DOMContentLoaded', () => new UploadCard());