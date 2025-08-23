import React from 'react'
export function Shimmer({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{ position:'relative', overflow:'hidden', background:'rgba(0,0,0,0.06)', borderRadius:8, ...style }}>
      <div style={{
        position:'absolute', inset:0, transform:'translateX(-100%)',
        background:'linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent)',
        animation:'shimmer 1.2s infinite'
      }} />
      <style dangerouslySetInnerHTML={{ __html: '@keyframes shimmer { 100% { transform: translateX(100%);} }' }} />
    </div>
  )
}
