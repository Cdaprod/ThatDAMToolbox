// /docker/web-app/src/components/Cards.tsx
'use client'
import React, { useRef } from "react";

// --- types ---
export interface BatchCardProps {
  batch: { id?: string; batch?: string; count?: number; items?: unknown[] };
  onClick?: () => void;
}
export interface VideoCardProps {
  data: {
    artifact?: {
      preview?: string;
      width?: number;
      height?: number;
      path?: string;
      duration?: number;
      mime?: string;
    };
    scenes?: { url: string }[];
    score?: number;
  };
}
export interface UploadCardProps {
  onUpload: (files: File[]) => void;
  loading?: boolean;
}

// --- BatchCard ---
export function BatchCard({ batch, onClick }: BatchCardProps) {
  const name = batch.batch ?? batch.id ?? "";
  const count = batch.count ?? (batch.items?.length ?? "");
  return (
    <button className="batch-link" data-batch={name} onClick={onClick}>
      📁 {name} <span className="badge">{count}</span>
    </button>
  );
}

// --- VideoCard ---
export function VideoCard({ data }: VideoCardProps) {
  const { artifact, scenes, score } = data;
  return (
    <div className="video-card m-2 border border-gray-800 p-3">
      <video
        src={artifact?.preview ?? ""}
        width={artifact?.width ?? 240}
        height={artifact?.height ?? 120}
        controls
        className="block mb-2 max-w-full"
      />
      <div className="text-sm mb-1">
        <b>{artifact?.path}</b> <br />
        {artifact?.duration}s • {artifact?.mime}
      </div>
      {scenes && scenes.length > 0 && (
        <div>
          <small>Scenes: </small>
          {scenes.map((s, i) => (
            <img key={i} src={s.url} alt="thumb" width={48} height={32} className="mr-1 inline-block" />
          ))}
        </div>
      )}
      {score && <div>Score: {score}</div>}
    </div>
  );
}

// --- UploadCard ---
export function UploadCard({ onUpload, loading }: UploadCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    onUpload(files);
    e.target.value = '';
  }
  return (
    <div className="mt-6">
      <input
        type="file"
        multiple
        ref={fileRef}
        className="hidden"
        onChange={handleFiles}
        disabled={loading}
      />
      <button
        disabled={loading}
        onClick={() => fileRef.current?.click()}
        className="mr-2"
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