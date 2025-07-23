// /docker/web-app/components/ToolCard.tsx
'use client';
import Link from 'next/link';
import { dashboardTools } from './dashboardTools';
import clsx from 'clsx';

export default function ToolCard({ href }: { href: string }) {
  const tool = dashboardTools.find((t) => t.href === href);
  if (!tool) return null;

  const { title, icon: Icon, color } = tool;

  return (
    <Link
      href={href}
      className={clsx(
        'rounded-xl p-6 shadow-lg text-white flex flex-col items-center justify-center transition transform hover:scale-[1.03]',
        'bg-gradient-to-br',
        color,
      )}
    >
      <Icon className="text-4xl mb-3" aria-hidden />
      <span className="text-xl font-semibold text-center">{title}</span>
    </Link>
  );
}