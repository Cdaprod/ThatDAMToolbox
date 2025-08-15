// /docker/web-app/src/components/DAMExplorer/StatusBar.tsx
import React from 'react'
import { AlertCircle } from 'lucide-react'
import { statusClasses } from '../../styles/theme'
import type { StatusMessage } from './AssetExplorer'

interface Props {
  message?: string
  type?: StatusMessage['type']
  onDismiss?: () => void
}

// Toast-like status message bar
const StatusBar: React.FC<Props> = ({ message, type = 'info', onDismiss }) => {
  if (!message) return null

  return (
    <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg border shadow-lg ${statusClasses[type]} z-50`}>
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
  )
}

export default StatusBar
