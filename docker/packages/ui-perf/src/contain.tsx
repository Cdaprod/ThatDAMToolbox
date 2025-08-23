import React from 'react'
export default function Contain({ children, minHeight = 0 }:{ children: React.ReactNode; minHeight?: number }) {
  return (
    <div style={{
      contentVisibility: 'auto',
      containIntrinsicSize: `${minHeight}px`,
      contain: 'content'
    }}>
      {children}
    </div>
  )
}
