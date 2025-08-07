import { Eye, Tag, Trash2 } from 'lucide-react';
import { useAssets } from '@/providers/AssetProvider';
import { bus } from '@/lib/eventBus';
import type { Action } from '@/types/actions';
import type { Asset } from '@/lib/apiAssets';

export function useAssetActions(asset?: Asset): Action[] {
  const { remove } = useAssets();
  return [
    {
      label: 'Preview',
      icon: Eye,
      handler: (ids) => bus.emit('preview', { id: ids[0] }),
    },
    {
      label: 'Tag',
      icon: Tag,
      handler: (ids) => bus.emit('tag-open', { ids }),
    },
    {
      label: 'Delete',
      icon: Trash2,
      handler: (ids) => remove(ids),
    },
  ];
}
