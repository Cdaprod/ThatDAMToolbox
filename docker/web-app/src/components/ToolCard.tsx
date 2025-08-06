'use client';

import Link from 'next/link';
import { dashboardTools } from './dashboardTools';
import clsx from 'clsx';
import { sizeClasses, iconClasses, titleClasses } from '@/styles/theme';

interface ToolCardProps {
  href: string;
  size?: 'small' | 'medium' | 'large';
  isRelated?: boolean;
  onFocus?: (toolId: string) => void;
}

export default function ToolCard({
  href,
  size = 'medium',
  isRelated = false,
  onFocus,
}: ToolCardProps) {
  const tool = dashboardTools.find((t) => t.href === href);
  if (!tool) return null;

  const { id, title, icon: Icon, color } = tool;

  // Sizing and style classes

  return (
    <Link
      href={href}
      onMouseEnter={() => onFocus?.(id)}
      className={clsx(
        'w-full h-full bg-white rounded-xl shadow-sm hover:shadow-md',
        'transition-shadow duration-150 ease-out',
        'flex flex-col items-center justify-center',
        sizeClasses[size],
        isRelated && 'ring-2 ring-theme-accent'
      )}
    >
      <Icon
        className={clsx(iconClasses[size], color, 'flex-shrink-0')}
        aria-hidden="true"
      />
      <span className={clsx(titleClasses[size], 'text-gray-900')}>
        {title}
      </span>
    </Link>
  );
}