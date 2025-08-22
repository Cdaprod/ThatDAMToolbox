'use client'
import { useEffect, useRef, useState } from 'react'

export default function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  const [canPlay, setCanPlay] = useState(false)
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.load(); setCanPlay(true); io.disconnect() }
    }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  return (
    <div style={{ position:'relative', aspectRatio:'16/9', borderRadius:16, overflow:'hidden' }}>
      <video
        ref={ref}
        playsInline
        muted
        loop
        autoPlay={false}
        preload="none"
        poster="/images/hero-poster.jpg"
        style={{ width:'100%', height:'100%', objectFit:'cover', filter:'contrast(1.05)' }}
      >
        {!reduced && canPlay && (
          <>
            <source src="/media/hero.webm" type="video/webm" />
            <source src="/media/hero.mp4"  type="video/mp4" />
          </>
        )}
      </video>
      {/* graceful fallback motion */}
      {reduced && <div style={{ position:'absolute', inset:0, background:
        'radial-gradient(100% 100% at 50% 0%, rgba(0,0,0,.15), transparent 60%)' }} />}
    </div>
  )
}

