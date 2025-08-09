'use client'

/**
 * CookieBanner - simple consent banner.
 *
 * Example: <CookieBanner /> at root layout.
 */
import { useEffect, useState } from 'react'

export default function CookieBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const ok = window.localStorage.getItem('cookie-consent')
    if (!ok) setShow(true)
  }, [])

  const accept = () => {
    window.localStorage.setItem('cookie-consent', 'true')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className='fixed bottom-0 inset-x-0 p-4 bg-gray-800 text-white flex justify-between text-sm'>
      <span>We use cookies to analyze traffic.</span>
      <button onClick={accept} className='underline'>Accept</button>
    </div>
  )
}
