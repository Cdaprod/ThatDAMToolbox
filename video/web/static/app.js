/* ----------------------------------------------------
 *  Extensible Video App Architecture  (single source of truth)
 * -------------------------------------------------- */
import '/static/components/upload-card.js';
import '/static/components/batch-card.js';
import '/static/components/video-card.js';

/* ─────────────── 1.  CORE ─────────────── */

class EventBus{
  #evt={};
  on(ev,cb){(this.#evt[ev]??=[]).push(cb);}
  off(ev,cb){this.#evt[ev]=(this.#evt[ev]??[]).filter(f=>f!==cb);}
  emit(ev,d){(this.#evt[ev]??[]).forEach(f=>f(d));}
}

class Config{
  #s={
    baseUrl : window.location.origin,
    endpoints:{
      batches :     '/batches',
      batchCard:id=>`/batches/${id}/cards`,
      upload  :     '/batches/from-upload',
      motion  :     '/motion/extract',
      devices :     '/hwcapture/devices',
      stream  :     '/hwcapture/stream',
      witness :     '/hwcapture/witness_record'
    },
    ui:{
      loadingMessages:{
        batches:'Loading batches…',
        upload :'Uploading…',
        motion :'Extracting motion frames…',
        witness:'Starting witness recording…'
      }
    }
  };
  get(p){return p.split('.').reduce((o,k)=>o?.[k],this.#s);}
}

class PluginManager{
  #map=new Map();
  constructor(bus){this.bus=bus;}
  register(name,inst){
    if(this.#map.has(name)) throw Error(`${name} already registered`);
    this.#map.set(name,inst); inst.init?.(this.bus);
    this.bus.emit('plugin:registered',{name,plugin:inst});
  }
  get(n){return this.#map.get(n);}
}

/* small utilities reused by several managers */
const util={
  badge:n=>`<span class="badge">${n}</span>`,
  fetchJson: async (url,opt={})=>{
    const r=await fetch(url,{redirect:'follow',...opt});
    if(!r.ok) throw Error(`HTTP ${r.status}`); return r.json();
  },
  urlFor:u=>u.startsWith('http')?u:`${window.location.origin}${u.startsWith('/')?'':'/'}${u}`
};

/* ─────────────── 2.  MANAGERS ─────────────── */

class BaseManager{
  constructor(bus,cfg){this.bus=bus;this.cfg=cfg;this.setup();}
  $(sel,ctx=document){return ctx.querySelector(sel);}
  fetch(...a){return util.fetchJson(...a);}
  /* override */ setup(){}
}

class BatchManager extends BaseManager{
  #parsers=new Map(); #renderers=new Map();
  constructor(...a){super(...a);
    this.#parsers.set('default',this.#parseDefault.bind(this));
    this.#renderers.set('default',this.#renderDefault.bind(this));
  }
  setup(){
    this.bus.on('batch:refresh',_=>this.load());
    this.bus.on('batch:inspect',({batchId})=>this.inspect(batchId));
  }

  async load(){
    const box=this.$('#batches'); if(!box) return;
    box.innerHTML=`<div class="loading">🔄 ${this.cfg.get('ui.loadingMessages.batches')}</div>`;
    try{
      const res  = await this.fetch(this.cfg.get('baseUrl')+this.cfg.get('endpoints.batches'));
      const list = this.#parsers.get('default')(res);
      this.#renderers.get('default')(list);
      this.bus.emit('batch:loaded',{batches:list});
    }catch(e){
      box.innerHTML=`<div class="empty-state">❌ ${e.message}</div>`;
    }
  }

  /* ---------- default parser/renderer ---------- */
  #parseDefault(r){
    if(Array.isArray(r)) return r;
    if(r?.batches) return r.batches;
    if(r && typeof r==='object')
      return Object.keys(r).map(k=>({batch:k,count:r[k]}));
    return [];
  }
  #renderDefault(list){
    const box=this.$('#batches'); if(!box) return;
    if(!list.length){box.innerHTML='<div class="empty-state">📭 No batches found.</div>';return;}
    box.innerHTML=list.map(b=>`
      <button class="batch-link" data-batch="${b.batch??b.id}">
        📁 ${b.batch??b.id} ${util.badge(b.count)}
      </button>`).join('');
    box.querySelectorAll('.batch-link').forEach(btn=>
      btn.onclick=()=>this.bus.emit('batch:inspect',{batchId:btn.dataset.batch}));
  }

  /* ---------- rich inspect ---------- */
  async inspect(id){
    const box=this.$('#videos'); if(!box) return;
    box.innerHTML='<div class="loading">🔄 Loading…</div>';
    try{
      const res = await this.fetch(this.cfg.get('baseUrl')+
                     this.cfg.get('endpoints').batchCard(id));
      if(!res.items?.length){
        box.innerHTML='<div class="empty-state">📭 No videos in batch.</div>'; return;
      }
      const grid=document.createElement('div'); grid.className='video-grid';
      res.items.forEach(item=>{
        const vc=document.createElement('video-card'); vc.data=item; grid.append(vc);
      });
      box.replaceChildren(grid);
      this.bus.emit('batch:inspected',{batchId:id,count:res.items.length});
    }catch(e){
      box.innerHTML=`<div class="empty-state">❌ ${e.message}</div>`;
    }
  }
}

class UploadManager extends BaseManager{
  setup(){this.bus.on('upload:start',d=>this.#handle(d));}
  async #handle({files,batchName}){
    if(!files?.length) return alert('Pick file(s) first');
    const fd=new FormData();
    [...files].forEach(f=>fd.append('files',f));
    fd.append('batch',batchName||'uploads');
    await this.fetch(this.cfg.get('baseUrl')+this.cfg.get('endpoints.upload'),
                     {method:'POST',body:fd});
    this.bus.emit('batch:refresh');
  }
}

/* ─────────────── 3.  PLUGINS (optional) ─────────────── */

class AnalyticsPlugin{
  init(bus){['batch:inspected','upload:start']
    .forEach(ev=>bus.on(ev,d=>console.log('[analytics]',ev,d))); }
}
class ThemePlugin{
  #t={
    dark :{'--bg-color':'#0d1117','--text-color':'#eee','--accent-cyan':'#00d4ff'},
    light:{'--bg-color':'#fff','--text-color':'#000','--accent-cyan':'#0066cc'}
  };
  init(bus){this.bus=bus;}
  apply(n){const t=this.#t[n];if(!t)return;
    Object.entries(t).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
    this.bus.emit('theme:changed',{name:n});
  }
}

/* ─────────────── 4.  APP BOOTSTRAP ─────────────── */

const app=(()=>{           // isolated scope
  const bus=new EventBus(), cfg=new Config(), pm=new PluginManager(bus);
  const mgr={
    batch:new BatchManager(bus,cfg), 
    upload:new UploadManager(bus,cfg)
    // add additional improved managers here
  };
  pm.register('analytics',new AnalyticsPlugin());
  pm.register('theme',     new ThemePlugin());
  return {bus,cfg,pm,mgr};
})();

/* legacy global shims so existing HTML keeps working */
window.listBatches = ()=>app.mgr.batch.load();
window.inspectBatch=id=>app.bus.emit('batch:inspect',{batchId:id});

/* ─────────────── 5.  STARTUP ─────────────── */

document.addEventListener('DOMContentLoaded',()=>{
  app.mgr.batch.load();
  app.pm.get('theme')?.apply('dark');
});

/* ─────────────── 6.  BURGER ⇆ SIDEBAR Toggles─────────────── */
document.addEventListener("DOMContentLoaded", () => {
  const burger  = document.querySelector(".burger");
  const sidebar = document.querySelector(".sidebar");
  if (burger && sidebar) {
    burger.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }
});

/**
 * Load the big DAM-Explorer bundle *after* main content is interactive.
 *  – requestIdleCallback → will wait until browser is idle
 *  – if not supported, falls back to a 500 ms timeout
 */
function mountDamExplorer () {
  // dynamic `import()` returns a promise; code is fetched on-demand
  //import('/static/components/dam-explorer.js').then(mod => {
  import('/static/components/dam-explorer.js').then(mod => {
    // The default export is the React component
    const React        = mod.__react__       // re-exported helper
    const ReactDOM     = mod.__react_dom__   // re-exported helper
    const DAMExplorer  = mod.default

    const rootEl = document.getElementById('dam-root')
    if (rootEl) {
      ReactDOM.createRoot(rootEl).render(React.createElement(DAMExplorer))
    }
  }).catch(err => {
    console.error('[DAM] failed to load:', err)
    const rootEl = document.getElementById('dam-root')
    if (rootEl) rootEl.textContent = '⚠️ Failed to load Explorer'
  })
}

if ('requestIdleCallback' in window) {
  requestIdleCallback(mountDamExplorer, { timeout: 2000 })
} else {
  setTimeout(mountDamExplorer, 500)          // back-off for older browsers
}