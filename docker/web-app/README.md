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
web-app/
├── Dockerfile
├── next.config.js
├── package.json
├── postcss.config.js
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
│   ├── Sidebar.tsx
│   ├── TopBar.tsx
│   ├── ModalCard.tsx
│   └── ...
├── Styles/
│   └── globals.css
└── ...
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
capture-daemon exposes WebRTC. When available, it negotiates a WebRTC session;
otherwise it falls back to the HLS preview.
