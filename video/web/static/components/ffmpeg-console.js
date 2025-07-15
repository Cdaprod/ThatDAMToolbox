/* FFmpeg Console – hooks into the new /api/v1/ffmpeg routes */

class FFMpegConsole {
  constructor(cfg){ this.cfg = cfg; }

  async _api(path, opt){                // small helper
    const r = await fetch(path, opt);
    if(!r.ok) throw Error(`HTTP ${r.status}`);
    return r.json();
  }

  async init(){
    this.txt   = document.getElementById('ff-input');
    this.btn   = document.getElementById('ff-run');
    this.out   = document.getElementById('ff-output');
    this.histL = document.getElementById('ff-history-list');

    this.btn.onclick = ()=> this.run();

    // arrow-up / arrow-down history
    this.hist = await this.fetchHistory();
    this.hPtr = this.hist.length;
    this.txt.addEventListener('keydown',e=>{
      if(e.key==='ArrowUp'){ e.preventDefault(); this.cycleHist(-1); }
      if(e.key==='ArrowDown'){ e.preventDefault(); this.cycleHist(+1); }
      if(e.key==='Enter' && (e.metaKey || e.ctrlKey)){
        e.preventDefault(); this.run();
      }
    });

    this.renderHistory();
  }

  async fetchHistory(limit=20){
    return this._api(`/api/v1/ffmpeg/history?limit=${limit}`);
  }
  renderHistory(){
    this.histL.innerHTML = this.hist.map(h=>`
      <li style="margin-bottom:.5rem;">
        <code>${h.cmd.join(' ')}</code>
      </li>`).join('');
  }
  cycleHist(dir){
    if(!this.hist.length) return;
    this.hPtr = (this.hPtr + dir + this.hist.length) % this.hist.length;
    this.txt.value = this.hist[this.hPtr].cmd.join(' ');
  }

  async run(){
    const cmd = this.txt.value.trim();
    if(!cmd) return;

    this.out.style.display = 'block';
    this.out.textContent = '⏳ Running…';

    try{
      const res = await this._api('/api/v1/ffmpeg','POST',{
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({cmd})
      });
      this.out.textContent =
        `exit=${res.exit}  elapsed=${res.elapsed.toFixed(2)}s\n\n`+
        (res.stderr || res.stdout || '(no output)');
    }catch(err){
      this.out.textContent = `❌ ${err.message}`;
    }

    // refresh history
    this.hist = await this.fetchHistory();
    this.hPtr = this.hist.length;
    this.renderHistory();
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  const cfg={}; new FFMpegConsole(cfg).init();
});