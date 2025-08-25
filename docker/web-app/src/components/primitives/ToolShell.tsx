'use client';
import React from 'react';

// Generic shell for tool pages with non-destructive badge
export default function ToolShell({ title, subtitle, right, children }:{
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 md:grid-cols-[1fr_360px]">
      <header className="md:col-span-2 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-zinc-400">{subtitle}</p>}
        </div>
        <div className="text-xs px-2 py-1 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-700">
          Non-destructive
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

