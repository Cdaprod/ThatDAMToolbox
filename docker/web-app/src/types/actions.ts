import type { ComponentType } from 'react';

export interface Action {
  label: string;
  icon: ComponentType<{ className?: string }>;
  handler: (ids: string[]) => void | Promise<void>;
}
