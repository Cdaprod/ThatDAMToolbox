class FFMpegConsole {
  constructor(cfg){ this.cfg = cfg; }

  async init(){
    // UI refs
    this.quickSelect   = document.getElementById('ff-quick-select');
    this.fileInput     = document.getElementById('ff-file-input');
    this.outputNameEl  = document.getElementById('ff-output-name');
    this.txt           = document.getElementById('ff-input');
    this.btn           = document.getElementById('ff-run');
    this.histL         = document.getElementById('ff-history-list');
    this.out           = document.getElementById('ff-output');

    // 1) Quick-command presets
    this.quickCommands = {
      trimIdle:
        'ffmpeg -i "{{input}}" ' +
        '-vf "mpdecimate,setpts=N/FRAME_RATE/TB" ' +
        '-af "silenceremove=stop_periods=-1:stop_duration=2:stop_threshold=-30dB,asetpts=N/SR/TB" ' +
        '"{{output}}"'
      // …add more here…
    };

    // 2) When user picks a Quick Command, inject it into the textarea
    this.quickSelect.addEventListener('change', () => {
      const key = this.quickSelect.value;
      if (!this.quickCommands[key]) return;
      // for local files we use the file’s client-side name in the template;
      // server-side must handle the multipart upload
      const fileName = this.fileInput.files[0]?.name || '';
      const output   = this.outputNameEl.value || 'output.mp4';
      const cmd = this.quickCommands[key]
                    .replace('{{input}}', fileName)
                    .replace('{{output}}', output);
      this.txt.value = cmd;
    });

    // 3) Load history
    await this.loadHistory();

    // 4) Run wiring + arrow-key navigation
    this.btn.onclick = () => this.run();
    this.txt.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp')   { e.preventDefault(); this.cycleHist(-1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.cycleHist(+1); }
      if (e.key === 'Enter' && (e.metaKey||e.ctrlKey)) {
        e.preventDefault();
        this.run();
      }
    });
  }

  // helper: call JSON API
  async _apiJson(path, body){
    const res = await fetch(path, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // helper: call multipart/form-data API
  async _apiForm(path, form){
    const res = await fetch(path, {method:'POST', body: form});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // fetch & render history
  async loadHistory(limit=20){
    try {
      const res = await fetch(`/api/v1/ffmpeg/history?limit=${limit}`);
      this.hist = await res.json();
    } catch {
      this.hist = [];
    }
    this.hPtr = this.hist.length;
    this.histL.innerHTML = this.hist.map(h=>`
      <li style="margin-bottom:.5rem;">
        <code>${h.cmd.join(' ')}</code>
      </li>`).join('');
  }

  cycleHist(dir){
    if (!this.hist.length) return;
    this.hPtr = (this.hPtr + dir + this.hist.length) % this.hist.length;
    this.txt.value = this.hist[this.hPtr].cmd.join(' ');
  }

  // run: choose JSON vs FormData based on fileInput
  async run(){
    const cmd = this.txt.value.trim();
    if (!cmd) return;

    this.out.style.display = 'block';
    this.out.textContent   = '⏳ Running…';

    try {
      let res;
      if (this.fileInput.files[0]) {
        const form = new FormData();
        form.append('file',    this.fileInput.files[0]);
        form.append('cmd',     cmd);
        // server must accept multipart here
        res = await this._apiForm('/api/v1/ffmpeg', form);
      } else {
        res = await this._apiJson('/api/v1/ffmpeg', {cmd});
      }

      this.out.textContent =
        `exit=${res.exit}  elapsed=${res.elapsed.toFixed(2)}s\n\n`+
        (res.stderr||res.stdout||'(no output)');

    } catch(err){
      this.out.textContent = `❌ ${err.message}`;
    }

    // refresh history afterwards
    await this.loadHistory();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new FFMpegConsole({}).init();
});