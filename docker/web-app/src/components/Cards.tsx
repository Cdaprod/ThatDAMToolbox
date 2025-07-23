'use client'
import React, { useRef } from "react";

// --- BatchCard ---
export function BatchCard({ batch, onClick }) {
  const name = batch.batch ?? batch.id ?? "";
  const count = batch.count ?? (batch.items?.length ?? "");
  return (
    <button className="batch-link" data-batch={name} onClick={onClick}>
      📁 {name} <span className="badge">{count}</span>
    </button>
  );
}

// --- VideoCard ---
export function VideoCard({ data }) {
  const { artifact, scenes, score } = data;
  return (
    <div className="video-card" style={{ margin: 8, border: '1px solid #333', padding: 12 }}>
      <video
        src={artifact?.preview ?? ""}
        width={artifact?.width ?? 240}
        height={artifact?.height ?? 120}
        controls
        style={{ display: 'block', marginBottom: 8, maxWidth: '100%' }}
      />
      <div style={{ fontSize: 14, marginBottom: 4 }}>
        <b>{artifact?.path}</b> <br />
        {artifact?.duration}s • {artifact?.mime}
      </div>
      {scenes?.length > 0 && (
        <div>
          <small>Scenes: </small>
          {scenes.map((s, i) => (
            <img key={i} src={s.url} alt="thumb" width={48} height={32} style={{ marginRight: 2 }} />
          ))}
        </div>
      )}
      {score && <div>Score: {score}</div>}
    </div>
  );
}

// --- UploadCard ---
export function UploadCard({ onUpload, loading }) {
  const fileRef = useRef();
  function handleFiles(e) {
    onUpload([...e.target.files]);
    e.target.value = null; // reset
  }
  return (
    <div style={{ marginTop: 24 }}>
      <input type="file" multiple ref={fileRef} style={{ display: 'none' }}
        onChange={handleFiles}
        disabled={loading}
      />
      <button disabled={loading}
        onClick={() => fileRef.current?.click()}
        style={{ marginRight: 8 }}
      >
        ⬆️ Upload
      </button>
    </div>
  );
}

export function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="
        bg-glass-bg
        backdrop-blur
        border border-glass-border
        rounded-lg
        shadow-md
        p-4
        transition hover:shadow-lg
      ">
      {children}
    </div>
  )
}