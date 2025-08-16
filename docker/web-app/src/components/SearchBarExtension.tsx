// /docker/web-app/src/components/SearchBarExtension.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  Filter,
  Sparkles,
  Calendar,
  FileType,
  Clock,
  X,
  Tag,
  Loader2
} from 'lucide-react'

export interface SearchResult {
  id: string
  title: string
  subtitle?: string
  type?: string
  score?: number
  metadata?: Record<string, any>
  thumbnail?: string
  path?: string
}

export interface SearchFilters {
  dateFrom?: string
  dateTo?: string
  fileType?: string
  duration?: string
  tags?: string[]
  [key: string]: any
}

export interface SearchBarProps {
  placeholder?: string
  onSearch?: (query: string, filters?: SearchFilters) => Promise<SearchResult[]>
  onVectorSearch?: (query: string) => Promise<SearchResult[]>
  onResultSelect?: (result: SearchResult) => void
  className?: string
  showFilters?: boolean
  showVectorSearch?: boolean
  availableTags?: string[]
  availableFileTypes?: string[]
  customFilters?: React.ReactNode
  debounceMs?: number
  maxResults?: number
  loading?: boolean
}

const SearchBarExtension: React.FC<SearchBarProps> = ({
  placeholder = 'Search...',
  onSearch,
  onVectorSearch,
  onResultSelect,
  className = '',
  showFilters = true,
  showVectorSearch = true,
  availableTags = [],
  availableFileTypes = ['mp4', 'mov', 'avi', 'mkv', 'jpg', 'png', 'pdf', 'doc'],
  customFilters,
  debounceMs = 300,
  maxResults = 50,
  loading = false
}) => {
  const [query, setQuery] = useState('')
  const [vectorQuery, setVectorQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [filters, setFilters] = useState<SearchFilters>({})
  const [showResults, setShowResults] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [showVectorPanel, setShowVectorPanel] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const debouncedSearch = useCallback(
    (searchQuery: string, searchFilters: SearchFilters) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(async () => {
        if (!searchQuery.trim() || !onSearch) {
          setResults([])
          setShowResults(false)
          return
        }

        setIsSearching(true)
        try {
          const searchResults = await onSearch(searchQuery, searchFilters)
          setResults(searchResults.slice(0, maxResults))
          setShowResults(true)
          setSelectedIndex(-1)
        } catch (error) {
          console.error('Search error:', error)
          setResults([])
        } finally {
          setIsSearching(false)
        }
      }, debounceMs)
    },
    [onSearch, debounceMs, maxResults]
  )

  useEffect(() => {
    debouncedSearch(query, filters)
  }, [query, filters, debouncedSearch])

  const handleVectorSearch = async () => {
    if (!vectorQuery.trim() || !onVectorSearch) return

    setIsSearching(true)
    try {
      const searchResults = await onVectorSearch(vectorQuery)
      setResults(searchResults.slice(0, maxResults))
      setShowResults(true)
      setSelectedIndex(-1)
    } catch (error) {
      console.error('Vector search error:', error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        setShowResults(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const handleResultSelect = (result: SearchResult) => {
    onResultSelect?.(result)
    setShowResults(false)
    setQuery('')
    setSelectedIndex(-1)
  }

  const updateFilter = (key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }))
  }

  const clearFilters = () => {
    setFilters({})
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
        setShowFilterPanel(false)
        setShowVectorPanel(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const hasActiveFilters = Object.values(filters).some(value =>
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  )

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="flex items-center bg-surface border border-color-border rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <div className="pl-4">
            <Search className="w-5 h-5 text-color-muted" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query && setShowResults(true)}
            placeholder={placeholder}
            className="flex-1 px-4 py-3 text-sm bg-transparent border-0 focus:outline-none focus:ring-0"
          />
          <div className="flex items-center pr-2 space-x-1">
            {showFilters && (
              <button
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className={`p-2 rounded-md transition-colors ${
                  showFilterPanel || hasActiveFilters
                    ? 'bg-color-primary-bg text-theme-primary'
                    : 'text-color-muted hover:text-theme-primary hover:bg-surface'
                }`}
                title="Filters"
              >
                <Filter className="w-4 h-4" />
              </button>
            )}
            {showVectorSearch && (
              <button
                onClick={() => setShowVectorPanel(!showVectorPanel)}
                className={`p-2 rounded-md transition-colors ${
                  showVectorPanel
                    ? 'bg-color-accent-bg text-theme-primary'
                    : 'text-color-muted hover:text-theme-primary hover:bg-surface'
                }`}
                title="AI Search"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}
            {(isSearching || loading) && (
              <div className="p-2">
                <Loader2 className="w-4 h-4 animate-spin text-theme-primary" />
              </div>
            )}
          </div>
        </div>
        {hasActiveFilters && (
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, value]) => {
              if (!value || (Array.isArray(value) && value.length === 0)) return null
              const displayValue = Array.isArray(value) ? value.join(', ') : String(value)
              return (
                <span
                  key={key}
                  className="inline-flex items-center px-2 py-1 bg-color-primary-bg text-theme-primary text-xs rounded-md"
                >
                  <span className="capitalize mr-1">{key}:</span>
                  <span className="font-medium">{displayValue}</span>
                  <button
                    onClick={() => updateFilter(key, Array.isArray(value) ? [] : '')}
                    className="ml-1 hover:text-theme-primary"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
            <button
              onClick={clearFilters}
              className="text-xs text-color-muted hover:text-theme-primary underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
      {showFilterPanel && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-color-border rounded-lg shadow-lg z-50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date Range
              </label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={e => updateFilter('dateFrom', e.target.value)}
                className="input w-full text-sm focus:ring-2 focus:ring-theme-primary"
                placeholder="From"
              />
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={e => updateFilter('dateTo', e.target.value)}
                className="input w-full text-sm focus:ring-2 focus:ring-theme-primary"
                placeholder="To"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                <FileType className="w-4 h-4 inline mr-1" />
                File Type
              </label>
              <select
                value={filters.fileType || ''}
                onChange={e => updateFilter('fileType', e.target.value)}
                className="input w-full text-sm focus:ring-2 focus:ring-theme-primary"
              >
                <option value="">All Types</option>
                {availableFileTypes.map(type => (
                  <option key={type} value={type}>
                    {type.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                <Clock className="w-4 h-4 inline mr-1" />
                Duration
              </label>
              <select
                value={filters.duration || ''}
                onChange={e => updateFilter('duration', e.target.value)}
                className="input w-full text-sm focus:ring-2 focus:ring-theme-primary"
              >
                <option value="">Any Duration</option>
                <option value="0-30">0–30 seconds</option>
                <option value="30-60">30–60 seconds</option>
                <option value="60-300">1–5 minutes</option>
                <option value="300+">5+ minutes</option>
              </select>
            </div>
          </div>
          {availableTags.length > 0 && (
            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium">
                <Tag className="w-4 h-4 inline mr-1" />
                Tags
              </label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {availableTags.map(tag => (
                  <label key={tag} className="flex items-center space-x-1 text-sm">
                    <input
                      type="checkbox"
                      checked={(filters.tags || []).includes(tag)}
                      onChange={e => {
                        const currentTags = filters.tags || []
                        const newTags = e.target.checked
                          ? [...currentTags, tag]
                          : currentTags.filter(t => t !== tag)
                        updateFilter('tags', newTags)
                      }}
                      className="rounded border-color-border text-theme-primary focus:ring-theme-primary"
                    />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {customFilters && (
            <div className="mt-4 pt-4 border-t border-color-border">{customFilters}</div>
          )}
        </div>
      )}
      {showVectorSearch && showVectorPanel && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-color-border rounded-lg shadow-lg z-50 p-4">
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              <Sparkles className="w-4 h-4 inline mr-1" />
              Describe what you're looking for
            </label>
            <textarea
              value={vectorQuery}
              onChange={e => setVectorQuery(e.target.value)}
              rows={3}
              placeholder="e.g., 'sunset over ocean', 'business meeting', 'happy children playing'"
              className="input w-full text-sm focus:ring-2 focus:ring-theme-primary resize-none"
            />
            <button
              onClick={handleVectorSearch}
              disabled={!vectorQuery.trim() || isSearching}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-theme-primary text-white rounded-md hover:bg-theme-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Search by Description</span>
            </button>
          </div>
        </div>
      )}
      {showResults && (
        <div
          ref={resultsRef}
          className="absolute top-full left-0 right-0 mt-2 bg-surface border border-color-border rounded-lg shadow-lg z-40 max-h-96 overflow-y-auto"
        >
          {results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => (
                <div
                  key={result.id}
                  onClick={() => handleResultSelect(result)}
                  className={`px-4 py-3 cursor-pointer border-b border-color-border last:border-b-0 transition-colors ${
                    index === selectedIndex
                      ? 'bg-color-primary-bg border-theme-primary'
                      : 'hover:bg-surface'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {result.thumbnail && (
                      <div className="flex-shrink-0">
                        <img
                          src={result.thumbnail}
                          alt={result.title}
                          className="w-12 h-12 object-cover rounded"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium truncate">
                          {result.title}
                        </h4>
                        {result.score && (
                          <span className="text-xs text-color-muted ml-2">
                            {(result.score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {result.subtitle && (
                        <p className="text-sm text-color-muted truncate mt-1">
                          {result.subtitle}
                        </p>
                      )}
                      <div className="flex items-center space-x-2 mt-1">
                        {result.type && (
                          <span className="inline-block px-2 py-1 text-xs bg-surface text-color-muted rounded">
                            {result.type}
                          </span>
                        )}
                        {result.path && (
                          <span className="text-xs text-color-muted truncate">
                            {result.path}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-color-muted">
              <Search className="w-8 h-8 mx-auto mb-2 text-color-muted" />
              <p className="text-sm">No results found</p>
              {query && (
                <p className="text-xs text-color-muted mt-1">
                  Try adjusting your search terms or filters
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SearchBarExtension