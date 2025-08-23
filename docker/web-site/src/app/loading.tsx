export default function Loading() {
  return (
    <div style={{ padding: 20, display:'grid', gap: 20 }}>
      <div style={{ height: 56, borderRadius:8, background:'rgba(0,0,0,.06)' }} />
      <div style={{ aspectRatio:'16/9', borderRadius:16, background:'rgba(0,0,0,.06)' }} />
      <div style={{ height: 180, borderRadius:12, background:'rgba(0,0,0,.06)' }} />
    </div>
  )
}

