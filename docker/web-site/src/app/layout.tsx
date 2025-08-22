import CookieBanner from '../components/CookieBanner'
import AmbientGrid from '../components/AmbientGrid'
import '@thatdamtoolbox/design-system'

/**
 * Root layout with optional analytics and cookie consent.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  return (
    <html>
      <body>
        <AmbientGrid />
        {children}
        <CookieBanner />
        {domain && (
          <script
            dangerouslySetInnerHTML={{
              __html: `if (localStorage.getItem('cookie-consent')==='true'){var s=document.createElement('script');s.defer=true;s.dataset.domain='${domain}';s.src='https://plausible.io/js/script.js';document.head.appendChild(s);}`
            }}
          />
        )}
      </body>
    </html>
  )
}
