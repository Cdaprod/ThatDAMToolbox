# WebApp Directory Structure

Create these files in your `/web-app` directory:

For provisioning the full stack, follow the [Provisioning Quickstart](../../docs/provisioning.md).

## Signup Flow

The `/signup` page creates a personal tenant and stores the tenant ID in the
auth session. After signup, users are routed to `/{tenant}/dashboard` and can
choose to create an organization or invite members.

Test locally with:

```bash
# run the dev server (binds 0.0.0.0 so LAN devices can connect)
# RabbitMQ must be running (e.g. `docker compose up rabbitmq`)

cd docker/web-app
yarn dev

# start the tenancy API (port 8082)
uvicorn tenancy.app:app --port 8082
# or: docker compose up tenancy

# in another shell invoke the tenancy API via the web-app proxy
curl -X POST http://localhost:3000/api/tenancy \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo","email":"demo@example.com"}'
```

Then open http://localhost:3000/signup in your browser.

## Development Tools

 - TanStack React Query Devtools are included by default (set `NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS=0` to disable).
- A React DevTools server also runs in development; visit
  http://localhost:8097 to inspect component trees without installing a
  browser extension.

## Core Configuration Files

```
web-app/
├── Dockerfile                    # Already provided above
├── package.json                  # Already provided above
├── next.config.js               # Already provided above
├── tsconfig.json                # TypeScript config
├── tailwind.config.js           # Tailwind CSS config
├── postcss.config.js            # PostCSS config
└── .env.local                   # Local environment variables
```

## Application Structure (Next.js 13+ App Router)

```
web-app/.
├── Dockerfile
├── next.config.js
├── next-env.d.ts
├── package.json
├── package-lock.json
├── packages
│   └── eventbus
│       ├── index.js
│       └── index.test.js
├── postcss.config.js
├── public
│   └── demo
│       └── bars720p30.mp4
├── README.md
├── src
│   ├── app
│   │   ├── api
│   │   │   ├── health
│   │   │   │   └── route.ts
│   │   │   ├── […path]
│   │   │   │   └── route.ts
│   │   │   └── schemas
│   │   │       └── route.ts
│   │   ├── [tenant]
│   │   │   └── dashboard
│   │   │       ├── camera-monitor
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │       ├── dam-explorer
│   │   │       │   └── page.tsx
│   │   │       ├── ffmpeg
│   │   │       │   └── page.tsx
│   │   │       ├── layout.tsx
│   │   │       ├── live
│   │   │   │   └── page.tsx
│   │   │   ├── motion
│   │   │   │   └── page.tsx
│   │   │   ├── page.tsx
│   │   │   ├── README.md
│   │   │   └── witness
│   │   │       └── page.tsx
│   │   ├── layout.tsx
│   │   ├── MainLayout.tsx
│   │   ├── page.tsx
│   │   └── schemas
│   │       └── page.tsx
│   ├── components
│   │   ├── CameraMonitor.tsx
│   │   ├── Cards.tsx
│   │   ├── DAMApp.tsx
│   │   ├── DAMExplorer.tsx
│   │   ├── dashboardTools.tsx
│   │   ├── ExplorerCard.tsx
│   │   ├── LayeredFS
│   │   │   ├── LayeredExplorer.tsx
│   │   │   ├── layout.ts
│   │   │   └── types.ts
│   │   ├── modals
│   │   │   ├── ActionSheet.tsx
│   │   │   ├── CameraMonitorModal.tsx
│   │   │   └── DAMExplorerModal.tsx
│   │   ├── overlays
│   │   │   ├── FalseColorOverlay.tsx
│   │   │   ├── FocusPeakingOverlay.tsx
│   │   │   ├── HistogramMonitor.tsx
│   │   │   ├── WaveformMonitor.tsx
│   │   │   └── ZebraOverlay.tsx
│   │   ├── primitives
│   │   │   ├── Container.tsx
│   │   │   ├── SelectableItem.tsx
│   │   │   └── Stack.tsx
│   │   ├── README.md
│   │   ├── RecordButton.tsx
│   │   ├── SearchBarExtension.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TagPopover.tsx
│   │   ├── __tests__
│   │   │   ├── AnalyticsCard.test.tsx
│   │   │   ├── CameraMonitor.test.ts
│   │   │   ├── Cards.test.tsx
│   │   │   ├── FFmpegConsole.test.tsx
│   │   │   ├── LayeredExplorer.test.tsx
│   │   │   ├── LayeredLayout.test.ts
│   │   │   ├── MotionExtract.test.tsx
│   │   │   ├── ToolCard.test.tsx
│   │   │   └── TopBar.test.tsx
│   │   ├── ToolCard.tsx
│   │   ├── tools
│   │   │   ├── AnalyticsCard.tsx
│   │   │   ├── FFmpegConsole.tsx
│   │   │   └── MotionExtract.tsx
│   │   └── TopBar.tsx
│   ├── context
│   │   └── ThemeContext.tsx
│   ├── hooks
│   │   ├── __tests__
│   │   │   ├── useCameraStream.test.ts
│   │   │   └── useIntelligentLayout.test.tsx
│   │   ├── useCameraStream.ts
│   │   ├── useEvent.ts
│   │   ├── useInputGesture.ts
│   │   ├── useIntelligentLayout.ts
│   │   ├── useLiveRecorder.ts
│   │   ├── useMediaRecorder.ts
│   │   ├── useSidebar.tsx
│   │   ├── useTheme.ts
│   │   ├── useTimecode.ts
│   │   └── useWsFrame.ts
│   ├── lib
│   │   ├── apiAssets.ts
│   │   ├── eventBus.ts
│   │   ├── networkConfig.ts
│   │   ├── serviceUp.js
│   │   ├── useVideoEvents.ts
│   │   ├── useVideoSocket.ts
│   │   ├── useVideoWs.ts
│   │   ├── videoApi.ts
│   │   ├── videoQueries.ts
│   │   └── video.ts
│   ├── providers
│   │   ├── AppProviders.tsx
│   │   ├── AssetProvider.tsx
│   │   ├── CaptureContext.tsx
│   │   ├── CaptureProvider.tsx
│   │   ├── ModalProvider.tsx
│   │   ├── QueryProvider.tsx
│   │   ├── README.md
│   │   └── VideoSocketProvider.tsx
│   ├── state
│   │   ├── selection.test.ts
│   │   └── selection.ts
│   ├── styles
│   │   ├── globals.css
│   │   ├── README.md
│   │   ├── theme.ts
│   │   └── tokens.css
│   ├── tools
│   │   ├── dam-explorer
│   │   │   └── actions.ts
│   │   └── motion
│   │       └── actions.ts
│   └── types
│       └── actions.ts
├── start.js
├── tailwind.config.js
├── tsconfig.json
├── .env.local
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   └── images/
├── App/
│   ├── [tenant]/
│   │   └── Dashboard/
│   │       ├── page.tsx             # Dashboard overview
│   │       ├── CameraMonitor/
│   │       │   └── page.tsx         # Fullscreen Camera Monitor
│   │       ├── AssetExplorer/
│   │       │   └── page.tsx         # Fullscreen Asset Explorer
│   │       └── ...                  # (Any other dashboard tools/features)
├── Components/
│   ├── CameraMonitor/
│   ├── DAMApp/
│   ├── DAMExplorer/
│   ├── Sidebar.tsx
│   ├── TopBar.tsx
│   ├── ModalCard.tsx
│   └── ...
├── Styles/
│   └── globals.css
└── tsconfig.test.json

39 directories, 112 files

```

## Quick Start Commands

### Used Command

```
docker build \
  --platform linux/arm64 \
  --target development \  -t cdaprod/video-web:dev \
  .
```

1. **Initialize the web-app directory:**

   ```bash
   mkdir web-app
   cd web-app
   npm init -y
   npm install next@14.0.4 react@^18.2.0 react-dom@^18.2.0 typescript @types/node @types react @types/react-dom
   ```

1. **Start development:**

   ```bash
   # From project root
   docker-compose up web-app
   ```

1. **Access the application:**

- Web App: http://localhost:3000
- API: http://localhost:8080

## Development Workflow

- **Hot Reload**: Changes to files in `/web-app` will automatically reload the container
- **API Integration**: Use `/api/video/*` routes to proxy to your Python API
- **Build for Production**: Use `target: production` in Docker Compose for optimized builds

## Environment Variables

Create `/web-app/.env.local` for local development:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
TENANCY_URL=http://localhost:8082/tenants
NODE_ENV=development
```

## API Mappings

Dashboard views map to service APIs as follows:

- Nodes & Plans → Supervisor (`/v1/nodes/*`, `/v1/bootstrap/*`)
- Events → Broker topics (`overlay.*`, `capture.*`, `video.*`, `webapp.*`)
- Capture devices → capture-daemon API (`/hwcapture/*`)
- Jobs & Search → video-api (`/video/*`)
- Trim / Idle Module → video-api (`/trim_idle/`)
- Observability → service `/health` and `/metrics` endpoints
- Credentials, Webhooks, Billing → api-gateway
- Access Control → api-gateway (`/credentials`)

All requests flow through the typed clients in `src/lib/api`, generated via `yarn run generate-api` for a single source of truth.

## Authentication

`AuthProvider` wraps the app and injects a bearer token into every API call via `src/lib/api`. Use it to handle login/logout and expose user context.
Google SSO is provided by NextAuth. Configure the following environment variables in `.env.local` or deployment secrets:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<32B random>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TENANT_DEFAULT_ALLOWED_DOMAINS=cdaprod.dev,example.com
```

Users sign in at `/login` and manage personal details under `/account`.


## Streaming protocol

`CameraMonitor` probes `/hwcapture/features` at runtime to determine whether the
capture-daemon exposes WebRTC. When available, it negotiates a WHEP session via
`/whep/<room>` to receive full‑res H.264 without transcoding; otherwise it falls
back to the HLS preview.

The monitor view automatically adjusts to device orientation. On portrait
screens the video fills the top of the display and controls stack beneath it,
eliminating the need to scroll.

Recording is controlled via simple HTTP calls:

```
curl -X POST http://<host>/daemon/record/start
curl -X POST http://<host>/daemon/record/stop
```

## Tenant routing

Pages are served under a dynamic `[tenant]` segment. Visiting
`/acme/dashboard` wraps the app in a `TenantProvider` so child components can
read the current tenant via `useTenant()`.

```tsx
import { useTenant } from '@/providers/TenantProvider'

export function LinkToAssets() {
  const tenant = useTenant()
  return <a href={`/${tenant}/assets`}>Assets</a>
}
```

Components and API calls should incorporate this tenant when building URLs so
backend services can serve tenant‑specific resources or enforce authentication.

## Provisioning a Device

1. Navigate to **Dashboard → Camera Monitor**.
2. Click **Provision Device**.
3. Copy the displayed join command and run it on the target device. The modal watches `/api/claims/{id}/watch` and updates once the device connects.
