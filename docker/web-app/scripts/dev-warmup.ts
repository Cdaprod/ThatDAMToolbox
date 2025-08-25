/**
 * Dev warmup: after `next dev` boots, ping a list of routes once to trigger compilation.
 * Usage: tsx scripts/dev-warmup.ts
 * Example: npm run dev:warm
 */
import http from 'http'

const HOST = process.env.WARMUP_HOST || 'localhost'
const PORT = Number(process.env.WARMUP_PORT || 3000)

export function getRoutes(): string[] {
  const tenant = process.env.WARMUP_TENANT || 'demo'
  const defaults = [
    '/',
    `/${tenant}/dashboard`,
    `/${tenant}/dashboard/camera-monitor`,
    `/${tenant}/dashboard/dam-explorer`,
    `/${tenant}/account`,
  ]
  return (process.env.WARM_ROUTES || defaults.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((r) => {
      if (r === '/' || r.startsWith(`/${tenant}`) || r.startsWith('/api')) {
        return r
      }
      const path = r.startsWith('/') ? r : `/${r}`
      return `/${tenant}${path}`
    })
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForServer(timeoutMs = 90_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          { host: HOST, port: PORT, path: '/', method: 'GET' },
          (res) => {
            res.resume()
            resolve()
          },
        )
        req.on('error', reject)
        req.end()
      })
      return true
    } catch {
      /* not up yet */
    }
    await wait(750)
  }
  return false
}

async function ping(path: string): Promise<void> {
  return new Promise((resolve) => {
    const req = http.request(
      { host: HOST, port: PORT, path, method: 'GET' },
      (res) => {
        res.resume()
        resolve()
      },
    )
    req.on('error', () => resolve()) // don’t crash dev on a bad route
    req.end()
  })
}

export async function warmup(): Promise<void> {
  const ok = await waitForServer()
  if (!ok) {
    console.warn('[warmup] Dev server not detected in time; skipping warmup.')
    process.exit(0)
  }
  const routes = getRoutes()
  console.log(`[warmup] Warming ${routes.length} route(s)…`)
  // ping serially to avoid stampeding the compiler
  for (const r of routes) {
    process.stdout.write(`  → ${r} … `)
    const t0 = Date.now()
    await ping(r)
    console.log(`${Date.now() - t0} ms`)
    // small delay gives the dev compiler breathing room
    await wait(200)
  }
  console.log('[warmup] Done.')
}

if (process.env.NODE_ENV !== 'test') {
  warmup()
}
