'use client'
import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { BatchCard, VideoCard, UploadCard } from './Cards';
import { damAppContainerStyle, damAppMainStyle } from '@/styles/theme';

// ────── Config + EventBus as Contexts ──────
const ConfigContext = createContext(null);
const EventBusContext = createContext(null);
export function useConfig() { return useContext(ConfigContext); }
export function useEventBus() { return useContext(EventBusContext); }

// Minimalist EventBus
class EventBus {
  #evt = {};
  on(ev, cb) { (this.#evt[ev] ??= []).push(cb); }
  off(ev, cb) { this.#evt[ev] = (this.#evt[ev] ?? []).filter(f => f !== cb); }
  emit(ev, d) { (this.#evt[ev] ?? []).forEach(f => f(d)); }
}

const config = {
  baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
  endpoints: {
    batches: '/batches',
    batchCard: id => `/batches/${id}/cards`,
    upload: '/api/v1/upload/',
  },
  ui: {
    loadingMessages: {
      batches: 'Loading batches…',
      upload: 'Uploading…'
    }
  }
};

// ────── Fetch Utility ──────
async function fetchJson(url, opt = {}) {
  const r = await fetch(url, { redirect: 'follow', ...opt });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  return r.json();
}

// ────── Theme Plugin (just a hook for now) ──────
function useTheme(name = "dark") {
  useEffect(() => {
    const t = name === "dark"
      ? { '--bg-color': '#0d1117', '--text-color': '#eee', '--accent-cyan': '#00d4ff' }
      : { '--bg-color': '#fff', '--text-color': '#000', '--accent-cyan': '#0066cc' };
    Object.entries(t).forEach(([k, v]) =>
      document.documentElement.style.setProperty(k, v)
    );
  }, [name]);
}

// ────── Core DAM Component ──────
export default function DAMApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [theme] = useState("dark");
  const bus = useRef(new EventBus()).current;

  // Provide Theme
  useTheme(theme);

  // Batch Loading
  async function loadBatches() {
    setLoading(true);
    try {
      const res = await fetchJson(config.baseUrl + config.endpoints.batches);
      setBatches(Array.isArray(res) ? res : res.batches || []);
    } catch (e) {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }

  // Inspect Batch
  async function inspectBatch(id) {
    setSelectedBatch(id);
    setLoading(true);
    try {
      const res = await fetchJson(config.baseUrl + config.endpoints.batchCard(id));
      setVideos(res.items || []);
    } catch (e) {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }

  // Upload handler
  async function handleUpload(files, batchName = 'uploads') {
    if (!files?.length) return alert("Pick file(s) first");
    const fd = new FormData();
    [...files].forEach(f => fd.append("files", f));
    fd.append("batch", batchName);
    setLoading(true);
    try {
      await fetch(config.baseUrl + config.endpoints.upload, { method: "POST", body: fd });
      loadBatches();
    } finally {
      setLoading(false);
    }
  }

  // EventBus registration
  useEffect(() => {
    bus.on("batch:refresh", loadBatches);
    bus.on("batch:inspect", ({ batchId }) => inspectBatch(batchId));
    return () => {
      bus.off("batch:refresh", loadBatches);
      bus.off("batch:inspect", ({ batchId }) => inspectBatch(batchId));
    };
    // eslint-disable-next-line
  }, []);

  // Initial load
  useEffect(() => { loadBatches(); }, []);

  // Sidebar toggle
  function toggleSidebar() { setSidebarOpen(o => !o); }

  return (
    <ConfigContext.Provider value={config}>
      <EventBusContext.Provider value={bus}>
        <div className="dam-app" style={damAppContainerStyle}>
          {/* Sidebar */}
          <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
            <button className="burger" onClick={toggleSidebar}>☰</button>
            <h2>Batches</h2>
            {loading ? (
              <div>{config.ui.loadingMessages.batches}</div>
            ) : (
              <div>
                {batches.length
                  ? batches.map(b =>
                    <BatchCard key={b.batch ?? b.id}
                      batch={b}
                      onClick={() => bus.emit('batch:inspect', { batchId: b.batch ?? b.id })}
                    />)
                  : <div>📭 No batches found.</div>
                }
              </div>
            )}
            <UploadCard onUpload={handleUpload} loading={loading} />
          </aside>

          {/* Main Content */}
          <main style={damAppMainStyle}>
            <h1>Video DAM</h1>
            {selectedBatch && <h3>Batch: {selectedBatch}</h3>}
            {loading && <div>Loading…</div>}
            {!loading && videos.length > 0 && (
              <div className="video-grid">
                {videos.map((item, i) => (
                  <VideoCard key={item.artifact?.sha1 || i} data={item} />
                ))}
              </div>
            )}
            {!loading && selectedBatch && !videos.length &&
              <div>📭 No videos in batch.</div>
            }
          </main>
        </div>
      </EventBusContext.Provider>
    </ConfigContext.Provider>
  );
}