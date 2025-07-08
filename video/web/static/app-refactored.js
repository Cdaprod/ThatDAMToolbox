/* ────────────────────────────────────────────────────────────
 *  video/web/static/app.js  –  ONE clean ES-module
 * ─────────────────────────────────────────────────────────── */

import '/static/components/batch-card.js';   // custom-element for preview cards

/* ──────────────── 1.  CORE INFRA  ──────────────── */

class EventBus {
  #evt = {};
  on (ev, cb){ (this.#evt[ev] ??= []).push(cb); }
  off(ev, cb){ this.#evt[ev] = (this.#evt[ev] ?? []).filter(f => f!==cb); }
  emit(ev, data){ (this.#evt[ev] ?? []).forEach(f => f(data)); }
}

class Config {
  #s = {
    baseUrl : window.location.origin,
    endpoints : {
      batches : '/batches',
      upload  : '/batches/from-upload',
      motion  : '/motion/extract',
      devices : '/hwcapture/devices',
      stream  : '/hwcapture/stream',
      witness : '/hwcapture/witness_record'
    },
    ui : {
      loadingMessages : {
        batches : 'Loading batches…',
        upload  : 'Uploading…',
        motion  : 'Extracting motion frames…',
        witness : 'Starting witness recording…'
      }
    }
  };
  get(p){ return p.split('.').reduce((o,k)=>o?.[k], this.#s); }
  set(path,val){
    const keys = path.split('.'); const last=keys.pop();
    const tgt = keys.reduce((o,k)=>(o[k]??={}), this.#s);
    tgt[last]=val;
  }
}

class PluginManager {
  #map = new Map();
  constructor(bus){ this.bus=bus; }
  register(name, inst){
    if(this.#map.has(name)) throw Error(`${name} already registered`);
    this.#map.set(name, inst); inst.init?.(this.bus);
    this.bus.emit('plugin:registered',{name,plugin:inst});
  }
  get(n){return this.#map.get(n);}
}

class BaseManager {
  constructor(bus,cfg){ this.bus=bus; this.cfg=cfg; this.setup(); }
  $(sel,ctx=document){ return ctx.querySelector(sel); }
  async fetchJson(url,opt={}){
    const r = await fetch(url,{redirect:'follow',...opt});
    if(!r.ok) throw Error(`HTTP ${r.status}`);
    const txt = await r.text(); return txt ? JSON.parse(txt):null;
  }
  /* to be overridden */ setup(){}
}

/* ──────────────── 2.  MANAGERS  ──────────────── */

class BatchManager extends BaseManager {
  #parsers = new Map();
  #renderers = new Map();
  constructor(b,c){ super(b,c);
    this.#parsers.set('default', this.#defaultParser.bind(this));
    this.#renderers.set('default', this.#defaultRenderer.bind(this));
  }
  setup(){
    this.bus.on('batch:refresh', _=>this.load());
    this.bus.on('batch:inspect', ({batchId})=>this.inspect(batchId));
  }

  /* public */
  load(){                                             // list batches
    const box=this.$('#batches'); if(!box) return;
    box.innerHTML=this.#loading();
    this.fetchJson(this.cfg.get('baseUrl')+this.cfg.get('endpoints.batches'))
        .then(res=>this.#render(this.#parse(res)))
        .catch(e=>box.innerHTML=this.#error(e.message));
  }

  inspect(id){                                        // show one batch
    const tgt = this.$('#videos'); if(!tgt) return;
    tgt.innerHTML='';                                 // purge old
    const el = document.createElement('batch-card');
    el.setAttribute('batch-id',id);
    tgt.append(el);
  }

  /* helpers */
  #parse(res){ return this.#parsers.get('default')(res);}
  #render(list){ this.#renderers.get('default')(list);}

  #defaultParser(r){
    if(Array.isArray(r)) return r;
    if(r?.batches)       return r.batches;
    if(r && typeof r==='object')
      return Object.keys(r).map(k=>({batch:k,count:r[k]}));
    return [];
  }

  #defaultRenderer(batches){
    const box=this.$('#batches'); if(!box) return;
    if(!batches.length){ box.innerHTML=this.#empty('No batches found.'); return;}
    box.innerHTML=batches.map(b=>`
      <button class="batch-link" data-batch="${b.batch ?? b.id}">
        📁 ${b.batch ?? b.id} ${this.#badge(b.count)}
      </button>`).join('');
    box.querySelectorAll('.batch-link').forEach(btn=>{
      btn.onclick=()=>this.bus.emit('batch:inspect',{batchId:btn.dataset.batch});
    });
  }

  #badge(n){ return `<span class="badge">${n}</span>`; }
  #loading(){ return `<div class="loading">🔄 ${this.cfg.get('ui.loadingMessages.batches')}</div>`;}
  #error(m){   return `<div class="empty-state">❌ ${m}</div>`; }
  #empty(m){   return `<div class="empty-state">📭 ${m}</div>`; }
}

class UploadManager extends BaseManager {
  setup(){ this.bus.on('upload:start', d=>this.#handle(d)); }
  async #handle({files,batchName}){
    if(!files?.length) return alert('Pick file(s) first');
    const fd=new FormData();
    [...files].forEach(f=>fd.append('files',f));
    fd.append('batch',batchName||'uploads');
    await this.fetchJson(this.cfg.get('baseUrl')+this.cfg.get('endpoints.upload'),
                         {method:'POST',body:fd});
    this.bus.emit('batch:refresh');
  }
}

/* ──────────────── 3.  PLUGINS  ──────────────── */

class AnalyticsPlugin{ init(bus){this.bus=bus;
  ['batch:selected','upload:complete'].forEach(ev=>
    bus.on(ev,data=>console.log('[analytics]',ev,data)));
}}

class ThemePlugin{
  #themes={
    dark :{'--bg-color':'#0d1117','--text-color':'#eee','--accent-cyan':'#00d4ff'},
    light:{'--bg-color':'#fff','--text-color':'#000','--accent-cyan':'#0066cc'}
  };
  init(bus){this.bus=bus;}
  apply(name){const t=this.#themes[name]; if(!t) return;
    Object.entries(t).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
    this.bus.emit('theme:changed',{name});
  }
}

/* ──────────────── 4.  APP FACTORY & BOOT  ──────────────── */

const app = (()=>{                  // IIFE keeps top-level clean
  const bus = new EventBus(), cfg=new Config();
  const pm  = new PluginManager(bus);
  const mgr = {
    batch : new BatchManager(bus,cfg),
    upload: new UploadManager(bus,cfg)
  };
  pm.register('analytics', new AnalyticsPlugin());
  pm.register('theme',      new ThemePlugin());

  return {bus,cfg,pm,mgr};
})();

/* Temporary shims so legacy onclick="" keeps working */
window.listBatches  = ()=>app.mgr.batch.load();
window.inspectBatch = id => app.bus.emit('batch:inspect',{batchId:id});

/* ──────────────── 5.  SMALL DOM UTILITIES  ──────────────── */

const $ = (sel,ctx=document)=>ctx.querySelector(sel);
async function fetchJson(u,o={}){ const r=await fetch(u,o); return r.json(); }

/* coloured badge used by old CSS */
const style=document.createElement('style');
style.textContent='.badge{display:inline-block;background:var(--accent-cyan);color:#fff;font-size:.75rem;font-weight:600;padding:2px 6px;border-radius:12px;margin-left:.5rem;}';
document.head.append(style);

/* ──────────────── 6.  PAGE-SPECIFIC WIRING  ──────────────── */

document.addEventListener('DOMContentLoaded',()=>{

  /* sidebar nav */
  $('#burger')?.addEventListener('click',()=>$('#sidebar')?.classList.toggle('open'));

  document.querySelectorAll('.nav-list button').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('.nav-list button')
              .forEach(b=>b.classList.toggle('active',b===btn));
      const tgtId=btn.dataset.target;
      document.getElementById(tgtId)
              ?.scrollIntoView({behavior:'smooth',block:'start'});
      $('#sidebar')?.classList.remove('open');
    };
  });

  /* upload form */
  $('#uploadForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    app.bus.emit('upload:start',{
      files:$('#fileInput').files,
      batchName:$('input[name="batch"]').value.trim()
    });
  });

  /* witness teaser */
  $('#startWitness')?.addEventListener('click',async ()=>{
    const out=$('#witResult'); out.style.display='block'; out.textContent='🚀 starting…';
    try{
      const r=await fetchJson(app.cfg.get('endpoints.witness'),{method:'POST'});
      out.textContent=JSON.stringify(r,null,2);
    }catch(e){ out.textContent='❌ '+e.message; }
  });

  /* initial load & theme */
  app.mgr.batch.load();
  app.pm.get('theme').apply('dark');
});