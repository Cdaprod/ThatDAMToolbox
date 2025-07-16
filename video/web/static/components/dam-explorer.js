/* ------------------------------------------------------------------
 * Pure browser-ESM: every dependency imported by absolute URL
 * (no bundler, no extra <script> tags).
 * ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
 * Pure browser-ESM: every dependency imported by absolute URL
 * (no bundler, no extra <script> tags).
 * ------------------------------------------------------------------ */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback
} from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18/client';

/* helpers re-exported so the bootstrapper can grab them */
export const __react__     = React;
export const __react_dom__ = ReactDOM;

import {
  Search, Grid, List, Upload, Trash2, Tag, Folder,
  Image, Video, FileText, MoreVertical, ChevronRight,
  ChevronDown, Eye, Move, RefreshCw, Undo2, AlertCircle, Check
} from 'https://esm.sh/lucide-react@0.357.0';

// // Mock data structure representing your content-addressable assets
// const mockAssets = [
//   {
//     id: 'sha256:a1b2c3d4...',
//     name: 'mountain_sunset.jpg',
//     type: 'image',
//     size: 2.1,
//     dimensions: '1920x1080',
//     created: '2024-01-15T10:30:00Z',
//     modified: '2024-01-15T10:30:00Z',
//     path: '/projects/nature/photos',
//     tags: ['landscape', 'sunset', 'mountains'],
//     metadata: { camera: 'Nikon Z7', iso: 400, aperture: 'f/8' },
//     thumbnail: '/api/thumbnails/sha256:a1b2c3d4...',
//     status: 'processed'
//   },
//   {
//     id: 'sha256:e5f6g7h8...',
//     name: 'interview_raw.mp4',
//     type: 'video',
//     size: 156.8,
//     duration: '00:15:42',
//     created: '2024-01-16T14:22:00Z',
//     modified: '2024-01-16T14:22:00Z',
//     path: '/projects/documentary/footage',
//     tags: ['interview', 'raw', 'b-roll'],
//     metadata: { codec: 'h264', fps: 24, resolution: '4K' },
//     thumbnail: '/api/thumbnails/sha256:e5f6g7h8...',
//     status: 'processing'
//   },
//   {
//     id: 'sha256:i9j0k1l2...',
//     name: 'project_brief.pdf',
//     type: 'document',
//     size: 0.8,
//     pages: 12,
//     created: '2024-01-14T09:15:00Z',
//     modified: '2024-01-17T16:45:00Z',
//     path: '/projects/documentary/docs',
//     tags: ['brief', 'requirements'],
//     metadata: { author: 'David Cannan', version: '1.3' },
//     thumbnail: '/api/thumbnails/sha256:i9j0k1l2...',
//     status: 'processed'
//   }
// ];

// const mockFolders = [
//   { id: 'f1', name: 'Projects', path: '/projects', children: ['f2', 'f3'], expanded: true },
//   { id: 'f2', name: 'Nature Photography', path: '/projects/nature', children: ['f4'], expanded: false },
//   { id: 'f3', name: 'Documentary', path: '/projects/documentary', children: ['f5', 'f6'], expanded: true },
//   { id: 'f4', name: 'Photos', path: '/projects/nature/photos', children: [], expanded: false },
//   { id: 'f5', name: 'Footage', path: '/projects/documentary/footage', children: [], expanded: false },
//   { id: 'f6', name: 'Documents', path: '/projects/documentary/docs', children: [], expanded: false }
// ];

useEffect(() => {
  fetch('/api/v1/explorer/folders')
    .then(r => r.json()).then(setFolders).catch(console.error)
}, [])

useEffect(() => {
  fetch(`/api/v1/explorer/assets?path=${encodeURIComponent(currentPath)}`)
    .then(r => r.json()).then(setAssets).catch(console.error)
}, [currentPath])

const AssetThumbnail = ({ asset, selected, onSelect, onPreview }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'image': return <Image className="w-8 h-8" />;
      case 'video': return <Video className="w-8 h-8" />;
      default: return <FileText className="w-8 h-8" />;
    }
  };

  const getStatusColor = (status) => {
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

      {/* Quick Actions (appear on hover) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex space-x-1">
          <button className="p-1 bg-white rounded shadow hover:bg-gray-50">
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

const FolderTree = ({ folders, currentPath, onPathChange, onFolderToggle }) => {
  const renderFolder = (folderId, level = 0) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return null;

    return (
      <div key={folder.id} className={`ml-${level * 4}`}>
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

const StatusBar = ({ message, type = 'info', onDismiss }) => {
  if (!message) return null;

  const getStatusStyle = (type) => {
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

const DAMExplorer = () => {
  const [assets, setAssets] = useState(mockAssets);
  const [folders, setFolders] = useState(mockFolders);
  const [selectedAssets, setSelectedAssets] = useState(new Set());
  const [currentPath, setCurrentPath] = useState('/projects');
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTags, setFilterTags] = useState([]);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  
  // WebSocket connection for real-time updates
  const wsRef = useRef(null);

  // Auto-save timeout
  const autoSaveTimeoutRef = useRef(null);

  // Initialize WebSocket connection
  useEffect(() => {
    // In real implementation, connect to your WebSocket endpoint
    // wsRef.current = new WebSocket('ws://localhost:8080/ws');
    
    // Mock WebSocket behavior
    const mockWsUpdates = setInterval(() => {
      // Simulate real-time updates from other users or processing pipeline
      if (Math.random() > 0.95) { // 5% chance every second
        showStatus('Asset processing completed', 'success');
      }
    }, 1000);

    return () => {
      clearInterval(mockWsUpdates);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Auto-save mechanism
  const triggerAutoSave = useCallback((operation, data) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      // In real implementation, send to backend API
      console.log('Auto-saving:', operation, data);
      showStatus('Changes saved automatically', 'success');
    }, 500);
  }, []);

  const showStatus = (message, type = 'info') => {
    setStatusMessage({ message, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleAssetSelect = (assetId) => {
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

  const handlePathChange = (newPath) => {
    setCurrentPath(newPath);
    setSelectedAssets(new Set());
    // In real implementation, fetch assets for this path
  };

  const handleFolderToggle = (folderId) => {
    setFolders(prev => prev.map(folder => 
      folder.id === folderId ? { ...folder, expanded: !folder.expanded } : folder
    ));
  };

  const handleAssetMove = (assetIds, targetPath) => {
    setIsProcessing(true);
    
    // Store state for undo
    const undoData = {
      type: 'move',
      assets: assetIds,
      fromPath: currentPath,
      toPath: targetPath
    };
    setUndoStack(prev => [...prev, undoData]);
    
    // Update asset paths
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
      // Revert move operation
      setAssets(prev => prev.map(asset => 
        lastOperation.assets.includes(asset.id) 
          ? { ...asset, path: lastOperation.fromPath }
          : asset
      ));
      showStatus('Move operation undone', 'info');
    }
  };

  const handleDeleteAssets = (assetIds) => {
    if (!confirm(`Are you sure you want to delete ${assetIds.length} asset(s)?`)) return;
    
    // Soft delete - move to trash
    setAssets(prev => prev.map(asset => 
      assetIds.includes(asset.id) ? { ...asset, status: 'deleted' } : asset
    ));
    
    triggerAutoSave('delete', { assetIds });
    showStatus(`Moved ${assetIds.length} asset(s) to trash`, 'warning');
  };

  // Filter assets based on current path and search
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

  // Get unique tags for filtering
  const availableTags = [...new Set(assets.flatMap(asset => asset.tags))];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">DAM Explorer</h1>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>{filteredAssets.length} assets</span>
              <span>•</span>
              <span>{currentPath}</span>
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
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
            <h3 className="font-semibold text-gray-900 mb-3">Tags</h3>
            <div className="space-y-2">
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
          </div>
        </aside>

        {/* Asset Grid */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                {selectedAssets.size > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {selectedAssets.size} selected
                    </span>
                    <button
                      onClick={() => handleDeleteAssets(Array.from(selectedAssets))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-600 hover:bg-gray-50 rounded">
                      <Move className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-600 hover:bg-gray-50 rounded">
                      <Tag className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {isProcessing && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Asset Grid */}
            <div className={`grid gap-4 ${
              viewMode === 'grid' 
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' 
                : 'grid-cols-1'
            }`}>
              {filteredAssets.map(asset => (
                <AssetThumbnail
                  key={asset.id}
                  asset={asset}
                  selected={selectedAssets.has(asset.id)}
                  onSelect={handleAssetSelect}
                  onPreview={(asset) => console.log('Preview:', asset)}
                />
              ))}
            </div>

            {filteredAssets.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Folder className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-600">No assets found in this folder</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Status Bar */}
      <StatusBar 
        message={statusMessage?.message}
        type={statusMessage?.type}
        onDismiss={() => setStatusMessage(null)}
      />
    </div>
  );
};

export default DAMExplorer;