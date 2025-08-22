export default function AmbientGrid() {
  return (
    <>
      <div style={{
        position:'fixed', inset:0, pointerEvents:'none', zIndex:-1,
        backgroundImage:'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize:'40px 40px, 40px 40px',
        transform:'translateZ(0)'
      }}/>
    </>
  )
}

