import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Grid,
  List,
  Upload,
  Trash2,
  Tag,
  Folder,
  Image,
  Video,
  FileText,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Eye,
  Move,
  RefreshCw,
  Undo2,
  AlertCircle,
  Check,
} from 'lucide-react';

// TypeScript interfaces
interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document';
  size: number;
  dimensions?: string;
  duration?: string;
  pages?: number;
  created: string;
  modified: string;
  path: string;
  tags: string[];
  metadata: Record<string, any>;
  thumbnail?: string;
  status: 'processed' | 'processing' | 'error' | 'deleted';
}

interface FolderNode {
  id: string;
  name: string;
  path: string;
  children: string[];
  expanded: boolean;
}

interface StatusMessage {
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface UndoOperation {
  type: 'move' | 'delete';
  assets: string[];
  fromPath: string;
  toPath?: string;
}

// Mock data
const mockAssets: Asset[] = [
  {
    id: 'sha256:a1b2c3d4',
    name: 'mountain_sunset.jpg',
    type: 'image',
    size: 2.1,
    dimensions: '1920x1080',
    created: '2024-01-15T10:30:00Z',
    modified: '2024-01-15T10:30:00Z',
    path: '/projects/nature/photos',
    tags: ['landscape', 'sunset', 'mountains'],
    metadata: { camera: 'Nikon Z7', iso: 400, aperture: 'f/8' },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY3ZjAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlPC90ZXh0Pjwvc3ZnPg==',
    status: 'processed'
  },
  {
    id: 'sha256:e5f6g7h8',
    name: 'interview_raw.mp4',
    type: 'video',
    size: 156.8,
    duration: '00:15:42',
    created: '2024-01-16T14:22:00Z',
    modified: '2024-01-16T14:22:00Z',
    path: '/projects/documentary/footage',
    tags: ['interview', 'raw', 'b-roll'],
    metadata: { codec: 'h264', fps: 24, resolution: '4K' },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNjM2NmYxIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlZpZGVvPC90ZXh0Pjwvc3ZnPg==',
    status: 'processing'
  },
  {
    id: 'sha256:i9j0k1l2',
    name: 'project_brief.pdf',
    type: 'document',
    size: 0.8,
    pages: 12,
    created: '2024-01-14T09:15:00Z',
    modified: '2024-01-17T16:45:00Z',
    path: '/projects/documentary/docs',
    tags: ['brief', 'requirements'],
    metadata: { author: 'David Cannan', version: '1.3' },
    status: 'processed'
  },
  {
    id: 'sha256:m3n4o5p6',
    name: 'beach_waves.jpg',
    type: 'image',
    size: 3.4,
    dimensions: '2560x1440',
    created: '2024-01-18T08:15:00Z',
    modified: '2024-01-18T08:15:00Z',
    path: '/projects/nature/photos',
    tags: ['ocean', 'waves', 'blue'],
    metadata: { camera: 'Canon R5', iso: 200, aperture: 'f/11' },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzOWZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk9jZWFuPC90ZXh0Pjwvc3ZnPg==',
    status: 'processed'
  }
];

const mockFolders: FolderNode[] = [
  { id: 'f1', name: 'Projects', path: '/projects', children: ['f2', 'f3'], expanded: true },
  { id: 'f2', name: 'Nature Photography', path: '/projects/nature', children: ['f4'], expanded: false },
  { id: 'f3', name: 'Documentary', path: '/projects/documentary', children: ['f5', 'f6'], expanded: true },
  { id: 'f4', name: 'Photos', path: '/projects/nature/photos', children: [], expanded: false },
  { id: 'f5', name: 'Footage', path: '/projects/documentary/footage', children: [], expanded: false },
  { id: 'f6', name: 'Documents', path: '/projects/documentary/docs', children: [], expanded: false }
];

// Component: AssetThumbnail
const AssetThumbnail: React.FC<{
  asset: Asset;
  selected: boolean;
  onSelect: (id: string) => void;
  onPreview: (asset: Asset) => void;
}> = ({ asset, selected, onSelect, onPreview }) => {
  const getIcon = (type: Asset['type']) => {
    switch (type) {
      case 'image': return <Image className="w-8 h-8" />;
      case 'video': return <Video className="w-8 h-8" />;
      default: return <FileText className="w-8 h-8" />;
    }
  };

  const getStatusColor = (status: Asset['status']) => {
    switch (status) {
      case 'processed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div 
      className={`relative group cursor-pointer border-2 rounded-lg p-3 transition-all duration-200 hover:shadow-lg ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
      onClick={() => onSelect(asset.id)}
      onDoubleClick={() => onPreview(asset)}
    >
      {/* Thumbnail or Icon */}
      <div className="aspect-square mb-2 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
        {asset.thumbnail ? (
          <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-400">
            {getIcon(asset.type)}
          </div>
        )}
      </div>

      {/* Asset Info */}
      <div className="space-y-1">
        <h4 className="font-medium text-sm truncate" title={asset.name}>
          {asset.name}
        </h4>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{asset.size} MB</span>
          <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(asset.status)}`}>
            {asset.status}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex space-x-1">
          <button 
            className="p-1 bg-white rounded shadow hover:bg-gray-50"
            onClick={(e) => { e.stopPropagation(); onPreview(asset); }}
          >
            <Eye className="w-4 h-4" />
          </button>
          <button className="p-1 bg-white rounded shadow hover:bg-gray-50">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selection Indicator */}
      {selected && (
        <div className="absolute top-2 left-2 bg-blue-500 text-white rounded-full p-1">
          <Check className="w-3 h-3" />
        </div>
      )}
    </div>
  );
};

// Component: FolderTree
const FolderTree: React.FC<{
  folders: FolderNode[];
  currentPath: string;
  onPathChange: (path: string) => void;
  onFolderToggle: (id: string) => void;
}> = ({ folders, currentPath, onPathChange, onFolderToggle }) => {
  const renderFolder = (folderId: string, level: number = 0): React.ReactNode => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return null;

    return (
      <div key={folder.id} style={{ marginLeft: level * 1 + 'rem' }}>
        <div 
          className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-gray-100 ${
            currentPath === folder.path ? 'bg-blue-50 text-blue-700' : ''
          }`}
          onClick={() => onPathChange(folder.path)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFolderToggle(folder.id);
            }}
            className="p-1 hover:bg-gray-200 rounded"
          >
            {folder.children.length > 0 ? (
              folder.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="w-4 h-4" />
            )}
          </button>
          <Folder className="w-4 h-4 text-gray-600" />
          <span className="text-sm">{folder.name}</span>
        </div>
        {folder.expanded && folder.children.map(childId => renderFolder(childId, level + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {folders.filter(f => !folders.some(parent => parent.children.includes(f.id))).map(rootFolder => 
        renderFolder(rootFolder.id)
      )}
    </div>
  );
};

// Component: StatusBar
const StatusBar: React.FC<{
  message?: string;
  type?: StatusMessage['type'];
  onDismiss?: () => void;
}> = ({ message, type = 'info', onDismiss }) => {
  if (!message) return null;

  const getStatusStyle = (type: StatusMessage['type']) => {
    switch (type) {
      case 'success': return 'bg-green-100 text-green-800 border-green-300';
      case 'error': return 'bg-red-100 text-red-800 border-red-300';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg border shadow-lg ${getStatusStyle(type)} z-50`}>
      <div className="flex items-center space-x-2">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{message}</span>
        {onDismiss && (
          <button onClick={onDismiss} className="ml-2 hover:opacity-70">
            ×
          </button>
        )}
      </div>
    </div>
  );
};

// Main Component: AssetExplorer
const AssetExplorer: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>(mockAssets);
  const [folders, setFolders] = useState<FolderNode[]>(mockFolders);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [currentPath, setCurrentPath] = useState<string>('/projects/nature/photos');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mock real-time updates
  useEffect(() => {
    const mockWsUpdates = setInterval(() => {
      if (Math.random() > 0.98) {
        showStatus('Asset processing completed', 'success');
      }
    }, 2000);

    return () => {
      clearInterval(mockWsUpdates);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Auto-save mechanism
  const triggerAutoSave = useCallback((operation: string, data: any) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      console.log('Auto-saving:', operation, data);
      showStatus('Changes saved automatically', 'success');
    }, 500);
  }, []);

  const showStatus = (message: string, type: StatusMessage['type'] = 'info') => {
    setStatusMessage({ message, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleAssetSelect = (assetId: string) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  };

  const handlePathChange = (newPath: string) => {
    setCurrentPath(newPath);
    setSelectedAssets(new Set());
  };

  const handleFolderToggle = (folderId: string) => {
    setFolders(prev => prev.map(folder => 
      folder.id === folderId ? { ...folder, expanded: !folder.expanded } : folder
    ));
  };

  const handleAssetMove = (assetIds: string[], targetPath: string) => {
    setIsProcessing(true);
    
    const undoData: UndoOperation = {
      type: 'move',
      assets: assetIds,
      fromPath: currentPath,
      toPath: targetPath
    };
    setUndoStack(prev => [...prev, undoData]);
    
    setAssets(prev => prev.map(asset => 
      assetIds.includes(asset.id) ? { ...asset, path: targetPath } : asset
    ));
    
    triggerAutoSave('move', { assetIds, targetPath });
    setIsProcessing(false);
    showStatus(`Moved ${assetIds.length} asset(s) to ${targetPath}`, 'success');
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    
    const lastOperation = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    
    if (lastOperation.type === 'move') {
      setAssets(prev => prev.map(asset => 
        lastOperation.assets.includes(asset.id) 
          ? { ...asset, path: lastOperation.fromPath }
          : asset
      ));
      showStatus('Move operation undone', 'info');
    }
  };

  const handleDeleteAssets = (assetIds: string[]) => {
    if (!confirm(`Are you sure you want to delete ${assetIds.length} asset(s)?`)) return;
    
    setAssets(prev => prev.map(asset => 
      assetIds.includes(asset.id) ? { ...asset, status: 'deleted' as const } : asset
    ));
    
    triggerAutoSave('delete', { assetIds });
    showStatus(`Moved ${assetIds.length} asset(s) to trash`, 'warning');
    setSelectedAssets(new Set());
  };

  const handlePreview = (asset: Asset) => {
    setPreviewAsset(asset);
    showStatus(`Previewing ${asset.name}`, 'info');
  };

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    const matchesPath = asset.path === currentPath;
    const matchesSearch = searchQuery === '' || 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = filterTags.length === 0 || 
      filterTags.some(tag => asset.tags.includes(tag));
    const notDeleted = asset.status !== 'deleted';
    
    return matchesPath && matchesSearch && matchesFilter && notDeleted;
  });

  // Get unique tags
  const availableTags = [...new Set(assets.flatMap(asset => asset.tags))];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">Asset Explorer</h1>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>{filteredAssets.length} assets</span>
              <span>•</span>
              <span className="max-w-xs truncate">{currentPath}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow' : ''}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                title="Undo last action"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button 
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                onClick={() => showStatus('Upload functionality would be implemented here', 'info')}
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Folders</h3>
            <FolderTree 
              folders={folders}
              currentPath={currentPath}
              onPathChange={handlePathChange}
              onFolderToggle={handleFolderToggle}
            />
          </div>
          
          <div className="p-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Filter by Tags</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {availableTags.map(tag => (
                <label key={tag} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filterTags.includes(tag)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFilterTags(prev => [...prev, tag]);
                      } else {
                        setFilterTags(prev => prev.filter(t => t !== tag));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{tag}</span>
                </label>
              ))}
            </div>
            {filterTags.length > 0 && (
              <button
                onClick={() => setFilterTags([])}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800"
              >
                Clear filters
              </button>
            )}
          </div>
        </aside>

 
        {/* Asset Grid */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Toolbar */}
            {selectedAssets.size > 0 && (
              <div className="flex items-center justify-between mb-6 bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedAssets.size} asset{selectedAssets.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDeleteAssets(Array.from(selectedAssets))}
                      className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">Delete</span>
                    </button>
                    <button 
                      className="flex items-center space-x-1 px-3 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                      onClick={() => showStatus('Move functionality would be implemented here', 'info')}
                    >
                      <Move className="w-4 h-4" />
                      <span className="text-sm">Move</span>
                    </button>
                    <button 
                      className="flex items-center space-x-1 px-3 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                      onClick={() => showStatus('Tag functionality would be implemented here', 'info')}
                    >
                      <Tag className="w-4 h-4" />
                      <span className="text-sm">Tag</span>
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedAssets(new Set())}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear selection
                </button>
              </div>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </div>
            )}

            {/* Asset Grid/List */}
            <div className={`${
              viewMode === 'grid' 
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4' 
                : 'space-y-2'
            }`}>
              {filteredAssets.map(asset => (
                <AssetThumbnail
                  key={asset.id}
                  asset={asset}
                  selected={selectedAssets.has(asset.id)}
                  onSelect={handleAssetSelect}
                  onPreview={handlePreview}
                />
              ))}
            </div>

            {/* Empty state */}
            {filteredAssets.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Folder className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No assets found</h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery || filterTags.length > 0 
                    ? "Try adjusting your search or filters" 
                    : "This folder is empty"
                  }
                </p>
                {(searchQuery || filterTags.length > 0) && (
                  <div className="space-x-2">
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Clear search
                      </button>
                    )}
                    {filterTags.length > 0 && (
                      <button
                        onClick={() => setFilterTags([])}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
  
      {/* Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-60">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xl relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700"
              onClick={() => setPreviewAsset(null)}
            >
              ×
            </button>
            <h3 className="text-lg font-semibold mb-2">{previewAsset.name}</h3>
            {previewAsset.type === 'image' && previewAsset.thumbnail && (
              <img src={previewAsset.thumbnail} alt={previewAsset.name} className="w-full h-auto mb-4 rounded" />
            )}
            {previewAsset.type === 'video' && (
              <video controls src={previewAsset.thumbnail} className="w-full h-auto mb-4 rounded" />
            )}
            {previewAsset.type === 'document' && (
              <div className="mb-4 p-4 bg-gray-100 rounded">
                <FileText className="w-8 h-8 mb-2" />
                <div className="text-xs text-gray-700">
                  Document preview unavailable.
                </div>
              </div>
            )}
            <div className="text-sm text-gray-500">
              <div><b>Type:</b> {previewAsset.type}</div>
              <div><b>Size:</b> {previewAsset.size} MB</div>
              <div><b>Created:</b> {new Date(previewAsset.created).toLocaleString()}</div>
              <div><b>Modified:</b> {new Date(previewAsset.modified).toLocaleString()}</div>
              <div><b>Path:</b> {previewAsset.path}</div>
              <div><b>Tags:</b> {previewAsset.tags.join(', ')}</div>
              <div><b>Status:</b> {previewAsset.status}</div>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <StatusBar
        message={statusMessage?.message}
        type={statusMessage?.type}
        onDismiss={() => setStatusMessage(null)}
      />
    </div> {/* End of top-level container */}
  );
};

export default AssetExplorer;