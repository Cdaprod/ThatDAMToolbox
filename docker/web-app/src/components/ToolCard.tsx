'use client';

import Link from 'next/link';
import { dashboardTools } from './dashboardTools';
import clsx from 'clsx';

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

  // Responsive classes for padding & min-height
  const sizeClasses: Record<'small'|'medium'|'large', string> = {
    small:  'p-2 sm:p-4 min-h-[100px] sm:min-h-[120px]',
    medium: 'p-3 sm:p-6 min-h-[120px] sm:min-h-[160px]',
    large:  'p-4 sm:p-8 min-h-[140px] sm:min-h-[200px]',
  };

  // Responsive icon/text sizes
  const iconClasses: Record<'small'|'medium'|'large', string> = {
    small:  'text-xl sm:text-2xl mb-2 sm:mb-3',
    medium: 'text-2xl sm:text-4xl mb-2 sm:mb-3',
    large:  'text-3xl sm:text-6xl mb-2 sm:mb-4',
  };

  const titleClasses: Record<'small'|'medium'|'large', string> = {
    small:  'text-base sm:text-lg font-semibold text-center',
    medium: 'text-lg sm:text-xl font-semibold text-center',
    large:  'text-xl sm:text-2xl font-semibold text-center',
  };

  return (
    <Link href={href} className="w-full h-full">
      <div
        onMouseEnter={() => onFocus?.(id)}
        className={clsx(
          'rounded-xl shadow-lg text-white flex flex-col items-center justify-center',
          'transition-all duration-300 ease-out transform hover:scale-[1.03] bg-gradient-to-br',
          'w-full h-full', // Fill grid cell for mobile/landscape
          color,
          sizeClasses[size],
          isRelated && 'ring-2 ring-white ring-opacity-50'
        )}
      >
        <Icon className={iconClasses[size]} aria-hidden="true" />
        <span className={titleClasses[size]}>{title}</span>
      </div>
    </Link>
  );
}