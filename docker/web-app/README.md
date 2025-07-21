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
├── src/
│   ├── app/                     # App Router (Next.js 13+)
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   ├── globals.css         # Global styles
│   │   ├── dam/                # DAM-specific pages
│   │   │   ├── page.tsx        # DAM dashboard
│   │   │   ├── search/         # Search functionality
│   │   │   │   └── page.tsx
│   │   │   ├── ingest/         # Video ingestion
│   │   │   │   └── page.tsx
│   │   │   └── videos/         # Video management
│   │   │       ├── page.tsx
│   │   │       └── [id]/
│   │   │           └── page.tsx
│   │   └── api/                # API routes (Next.js API)
│   │       ├── health/
│   │       │   └── route.ts
│   │       └── dam/
│   │           └── proxy/
│   │               └── route.ts
│   ├── components/             # Reusable components
│   │   ├── ui/                 # Basic UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── input.tsx
│   │   ├── dam/                # DAM-specific components
│   │   │   ├── VideoCard.tsx
│   │   │   ├── SearchBox.tsx
│   │   │   └── IngestForm.tsx
│   │   └── layout/             # Layout components
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Footer.tsx
│   ├── lib/                    # Utilities and API clients
│   │   ├── api.ts              # API client for your Python backend
│   │   ├── utils.ts            # Utility functions
│   │   └── types.ts            # TypeScript type definitions
│   └── hooks/                  # Custom React hooks
│       ├── useApi.ts           # API interaction hooks
│       └── useDam.ts           # DAM-specific hooks
├── public/                     # Static assets
│   ├── favicon.ico
│   ├── logo.svg
│   └── images/
└── .dockerignore              # Docker ignore patterns
```

## Quick Start Commands

1. **Initialize the web-app directory:**
   
   ```bash
   mkdir web-app
   cd web-app
   npm init -y
   npm install next@14.0.4 react@^18.2.0 react-dom@^18.2.0 typescript @types/node @types/react @types/react-dom
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