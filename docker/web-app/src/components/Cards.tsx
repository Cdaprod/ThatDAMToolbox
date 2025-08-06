'use client'
import React, { useRef } from "react";
import {
  videoCardStyle,
  videoStyle,
  videoInfoStyle,
  sceneThumbStyle,
  uploadCardStyle,
  hiddenInputStyle,
  uploadButtonStyle,
} from '@/styles/theme';

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
    <div className="video-card" style={videoCardStyle}>
      <video
        src={artifact?.preview ?? ""}
        width={artifact?.width ?? 240}
        height={artifact?.height ?? 120}
        controls
        style={videoStyle}
      />
      <div style={videoInfoStyle}>
        <b>{artifact?.path}</b> <br />
        {artifact?.duration}s • {artifact?.mime}
      </div>
      {scenes?.length > 0 && (
        <div>
          <small>Scenes: </small>
          {scenes.map((s, i) => (
            <img key={i} src={s.url} alt="thumb" width={48} height={32} style={sceneThumbStyle} />
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
    <div style={uploadCardStyle}>
      <input
        type="file"
        multiple
        ref={fileRef}
        style={hiddenInputStyle}
        onChange={handleFiles}
        disabled={loading}
      />
      <button
        disabled={loading}
        onClick={() => fileRef.current?.click()}
        style={uploadButtonStyle}
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