class FFMpegConsole {
  constructor(cfg){ this.cfg = cfg; }

  async _api(path, opt){
    const r = await fetch(path, opt);
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    return r.json();
  }

  async init(){
    // UI refs
    this.quickSelect  = document.getElementById('ff-quick-select');
    this.inputSelect  = document.getElementById('ff-input-select');
    this.outputNameEl = document.getElementById('ff-output-name');
    this.txt          = document.getElementById('ff-input');
    this.btn          = document.getElementById('ff-run');
    this.histL        = document.getElementById('ff-history-list');
    this.out          = document.getElementById('ff-output');

    // 1) Define presets with {{input}} & {{output}}
    this.quickCommands = {
      trimIdle:
        'ffmpeg -i "{{input}}" ' +
        '-vf "mpdecimate,setpts=N/FRAME_RATE/TB" ' +
        '-af "silenceremove=stop_periods=-1:stop_duration=2:stop_threshold=-30dB,asetpts=N/SR/TB" ' +
        '"{{output}}"'
      // add more here…
    };

    // 2) Wire Quick-Commands → textarea
    this.quickSelect.addEventListener('change', () => {
      const key = this.quickSelect.value;
      if (!this.quickCommands[key]) return;
      const input  = this.inputSelect.value;
      const output = this.outputNameEl.value || 'output.mp4';
      const cmd = this.quickCommands[key]
                    .replace('{{input}}', input)
                    .replace('{{output}}', output);
      this.txt.value = cmd;
    });

    // 3) Populate video list for Input selector
    try {
      const videos = await fetch(`${window.location.origin}/api/dam/videos`)
                              .then(r => r.json());
      this.inputSelect.innerHTML = videos
        .map(v => `<option value="${v.url||v.path}">${v.filename||v.title}</option>`)
        .join('');
    } catch(err) {
      console.warn('FFmpegConsole: could not load video list', err);
      this.inputSelect.innerHTML = '<option value="">(none)</option>';
    }

    // 4) Load history of past runs
    await this.loadHistory();

    // 5) Run wiring + arrow-key history nav
    this.btn.onclick = () => this.run();
    this.txt.addEventListener('keydown', e => {
      if (e.key==='ArrowUp')   { e.preventDefault(); this.cycleHist(-1); }
      if (e.key==='ArrowDown') { e.preventDefault(); this.cycleHist(+1); }
      if (e.key==='Enter' && (e.metaKey||e.ctrlKey)){
        e.preventDefault(); this.run();
      }
    });
  }

  // fetch & render history
  async loadHistory(limit=20){
    try {
      this.hist = await this._api(`/api/v1/ffmpeg/history?limit=${limit}`);
      this.hPtr = this.hist.length;
      this.renderHistory();
    } catch(e) {
      console.warn('FFmpegConsole: history load failed', e);
      this.hist = [];
      this.renderHistory();
    }
  }

  renderHistory(){
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

  // execute & refresh history
  async run(){
    const cmd = this.txt.value.trim(); if(!cmd) return;
    this.out.style.display = 'block';
    this.out.textContent = '⏳ Running…';

    try {
      const res = await this._api('/api/v1/ffmpeg','POST',{
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({cmd})
      });
      this.out.textContent =
        `exit=${res.exit}  elapsed=${res.elapsed.toFixed(2)}s\n\n` +
        (res.stderr||res.stdout||'(no output)');
    } catch(err){
      this.out.textContent = `❌ ${err.message}`;
    }

    // refresh history so new entry shows up
    await this.loadHistory();
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  new FFMpegConsole({}).init();
});