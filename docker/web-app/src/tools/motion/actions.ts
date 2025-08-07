import { Activity } from 'lucide-react';
import type { Action } from '@/types/actions';

export function useAssetActions(): Action[] {
  return [
    {
      label: 'Run motion extract',
      icon: Activity,
      handler: (ids) => {
        console.log('motion extract', ids);
      },
    },
  ];
}
