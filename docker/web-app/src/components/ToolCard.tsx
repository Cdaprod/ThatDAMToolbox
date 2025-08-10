'use client';

import Link from 'next/link';
import { dashboardTools } from './dashboardTools';
import clsx from 'clsx';
import { sizeClasses, iconClasses, titleClasses, cardBaseClasses } from '../styles/theme';

interface ToolCardProps {
  toolId: string;
  size?: 'small' | 'medium' | 'large';
  isRelated?: boolean;
  onFocus?: (toolId: string) => void;
}

export default function ToolCard({
  toolId,
  size = 'medium',
  isRelated = false,
  onFocus,
}: ToolCardProps) {
  const tool = dashboardTools[toolId];
  if (!tool) return null;

  const { id, href, title, icon: Icon } = tool;

  // Sizing and style classes

  return (
    <Link
      href={href}
      onMouseEnter={() => onFocus?.(id)}
      className={clsx(
        'w-full h-full',
        cardBaseClasses,
        'hover:shadow-md transition-shadow duration-150 ease-out',
        'flex flex-col items-center justify-center',
        sizeClasses[size],
        isRelated && 'ring-2 ring-theme-primary'
      )}
    >
      <Icon
        className={clsx(iconClasses[size], 'text-theme-primary flex-shrink-0')}
        aria-hidden="true"
      />
      <span className={clsx(titleClasses[size], 'text-theme-primary')}>
        {title}
      </span>
    </Link>
  );
}