# WebApp Directory Structure

Create these files in your `/web-app` directory:

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
│   │   ├── dashboard
│   │   │   ├── camera-monitor
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── dam-explorer
│   │   │   │   └── page.tsx
│   │   │   ├── explorer
│   │   │   │   ├── layered
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── ffmpeg
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── live
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
│   ├── page.tsx                 # Root/home page
│   ├── layout.tsx               # Root layout
│   └── Dashboard/
│       ├── page.tsx             # Dashboard overview
│       ├── CameraMonitor/
│       │   └── page.tsx         # Fullscreen Camera Monitor
│       ├── AssetExplorer/
│       │   └── page.tsx         # Fullscreen Asset Explorer
│       └── ...                  # (Any other dashboard tools/features)
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
NODE_ENV=development
```

## Streaming protocol

`CameraMonitor` probes `/hwcapture/features` at runtime to determine whether the
capture-daemon exposes WebRTC. When available, it negotiates a WHEP session via
`/whep/<room>` to receive full‑res H.264 without transcoding; otherwise it falls
back to the HLS preview.

Recording is controlled via simple HTTP calls:

```
curl -X POST http://<host>/daemon/record/start
curl -X POST http://<host>/daemon/record/stop
```
