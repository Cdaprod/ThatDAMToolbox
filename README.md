![](/public/favicon/android-chrome-512x512.png)

#  ThatDAM (Digital Asset Management)
## A Hybrid-Cloud Media Indexer & Asset Acquisition Platform

[![CI-Build-and-Publish](https://github.com/Cdaprod/ThatDAMToolbox/actions/workflows/ci-build-and-publish.yml/badge.svg)](https://github.com/Cdaprod/ThatDAMToolbox/actions/workflows/ci-build-and-publish.yml)
[![Generate NodeProp Configuration](https://github.com/Cdaprod/ThatDAMToolbox/actions/workflows/generate-nodeprop-config.yml/badge.svg)](https://github.com/Cdaprod/ThatDAMToolbox/actions/workflows/generate-nodeprop-config.yml)
[![Generate Docker Compose Diagram](https://github.com/Cdaprod/ThatDAMToolbox/actions/workflows/generate-docker-diagram.yml/badge.svg)](https://github.com/Cdaprod/ThatDAMToolbox/actions/workflows/generate-docker-diagram.yml)
[![Engineer Production Environment](https://github.com/Cdaprod/ThatDAMToolbox/actions/workflows/ci-engineer-env.yml/badge.svg)](https://github.com/Cdaprod/ThatDAMToolbox/actions/workflows/ci-engineer-env.yml)
[![Create Project Milestones](https://github.com/Cdaprod/ThatDAMToolbox/actions/workflows/generate-milestones.yml/badge.svg)](https://github.com/Cdaprod/ThatDAMToolbox/actions/workflows/generate-milestones.yml)

<div align="center">

<p>
  <a href="https://youtube.com/@Cdaprod">
    <img src="https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="YouTube Channel" />
  </a>
  <a href="https://twitter.com/cdasmktcda">
    <img src="https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white" alt="Twitter Follow" />
  </a>
  <a href="https://www.linkedin.com/in/cdasmkt">
    <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn" />
  </a>
  <a href="https://github.com/Cdaprod">
    <img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" alt="GitHub followers" />
  </a>
  <a href="https://blog.min.io/author/david-cannan">
    <img src="https://img.shields.io/badge/Blog-FF5722?style=for-the-badge&logo=blogger&logoColor=white" alt="Personal Blog" />
  </a>
</p>

</div>

**By David Cannan (@Cdaprod)**

> **AI-Powered Digital Asset Management System**  
> Advanced media processing, hierarchical embedding generation, and intelligent content discovery for modern video workflows.

## Overview

**ThatDAM's** primary identity is as a **Digital Asset Management** platform -- where ingestion (camera, NAS, local drives, etc.) is just one of multiple asset acquisition methods, and the real value is **exploration, categorization, indexing, and hybrid-cloud access**.

A comprehensive Digital Asset Management (DAM) system that combines traditional media indexing with advanced AI-powered video processing. Built for content creators, video professionals, and organizations managing large media libraries.

### System Architecture

#### In our system:
- Ring of capture-daemon nodes = the core distributed file system ring
- Camera-proxy peers = the peripheral components that interface with cameras and feed into the ring

#### The camera-proxies are peers because they:
1. Interface with the core system but aren’t part of the main ring structure
2. Have specialized roles (camera interfacing) rather than general distributed storage duties
3. Connect to/communicate with the ring nodes rather than being ring participants themselves

#### In distributed systems terminology, this would be described as:
- Core ring nodes (capture-daemon DFS nodes)
- Edge peers or proxy peers (camera-proxy components)

This is a common pattern where you have a core distributed system (your DFS ring) with specialized peripheral components (camera proxies) that act as data ingress points. The proxies are peers to each other and to the system, but they’re not full participants in the ring consensus/storage mechanism.
So "camera-proxy peers" is the most systems-design-accurate description for those components in your architecture.​​​​​​​​​​​​​​​​

```
Browser  →  FastAPI  →  Database
              ↘︎  Worker Queue → ML Workers (AI/ffmpeg)
              ↘︎  /data Volume → Raw Media Assets
```

```mermaid
flowchart TD
  %% Minimal ThatDAMPlatform topology (Mermaid 11.5.0 safe)

  subgraph EDGE["On‑prem / Edge"]
    DEV["/dev/video* (camera)"]
    CAP["capture-daemon"]
    PROXY["camera-proxy"]
  end

  subgraph CLOUD["ThatDAMPlatform Cloud"]
    GW["API Gateway"]
    SFU["Live SFU (WHIP/WHEP)"]
    APP["Web App (Dashboard)"]
  end

  %% Device -> Edge services
  DEV --> CAP
  DEV --> PROXY

  %% Edge -> Cloud
  CAP -->|record & ingest| GW
  PROXY -->|enumerate/forward| GW
  PROXY -->|WHIP publish| SFU

  %% Client access
  APP -->|HTTPS| GW
  APP -->|WHEP view| SFU
``` 

See [Control Plane Bootstrapping](docs/TECHNICAL/BOOTSTRAP_ARCHITECTURE.md) for node roles and environment reconcile.

## Table of Contents

- [Core Features](#core-features)
- [AI Video Processing](#ai-video-processing)
- [System Architecture](#system-architecture-details)
- [Hardware Context](#hardware-context)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Deployment & Environments](#deployment--environments)
- [API Documentation](#api-documentation)
- [Development Roadmap](#development-roadmap)
- [Contributing](#contributing)
- [License](#license)

## Core Features

### 🧺 Docker Compose Service Topology

**This diagram is a high-level overview of how our three containers, their mounted volumes, and the shared network fit together:**

![Compose Service Topology](/public/serve/repository-docker-structure.svg)

### Services
- api-gateway (Go HTTP gateway)
- media-api (Go asset indexer)
- video-web (Next.js frontend)
- video-cli (CLI utilities)
### Volumes
- Host media library:
  - /mnt/b/Video/thatdamtoolbox → /data
  - /mnt/b/Video/_INCOMING → /data/_INCOMING
  - Local project video folder: ./video → /video
### Frontend code & build output:
  - ./docker/web-app → /app
  - /app/node_modules & /app/.next for runtime dependencies
- Database WAL store for CLI: db_wal → /var/lib/thatdamtoolbox/db
### Network
- All services attach to the damnet bridge network for internal communication.
- The frontend (video-web) connects to api-gateway (or media-api when standalone) over its published ports.

This topology ensures that each container has direct, read-write access to the same media directories, while isolating inter-service traffic on a dedicated Docker network.

---

### ✨ AI-Powered Media Processing

- **Hierarchical Video Embeddings**: Multi-layer (L0-L3) vector representations
- **Intelligent Content Discovery**: Semantic search across video libraries
- **Automated Metadata Enrichment**: AI-generated descriptions, tags, and classifications
- **Smart Frame Extraction**: Automatic key-frame and hero-image selection

### 🎬 Professional Video Workflows

- **Multi-Camera Sync**: Audio waveform analysis for perfect alignment
- **Motion Detection & Tracking**: Advanced computer vision capabilities
- **Speech-to-Text Processing**: Automated transcription with timeline sections
- **Blender Integration**: Direct pipeline to 3D workflows

### 🔄 Content Management

- **Batch Processing**: Efficient handling of large media collections
- **Network Sync**: SMB/NAS integration with metadata preservation
- **Stock Platform Publishing**: Automated uploads to licensing platforms
- **iPhone Photos Integration**: Seamless HEIC/ProRes import workflows

---

## AI Video Processing

### Hierarchical Embedding System

The core innovation of this DAM system is its multi-level video understanding:

#### Latest Depiction

```mermaid
sequenceDiagram
    participant UI as Browser
    participant JS as app.js
    participant Scan as BatchScanner
    participant API as /video.server (FastAPI)
    participant DAM as /api/embedding router
    participant Store as VectorStorage

    Note over UI: User drops a folder into web UI
    JS->>Scan: POST /scan?dir=/media/batch1
    Scan->>Scan: Walk dir, find foo.mp4
    Scan->>API: POST /api/embedding/videos/ingest {path:"/media/batch1/foo.mp4"}
    API->>DAM: forward call
    DAM->>Store: store L0 vector
    DAM-->>API: {uuid:"abcd-1234", levels:{L0:1}}
    API-->>Scan: 200 OK
    Note right of DAM: background task<br/>generates L1–L3
```

### Processing Levels

- **L0**: Raw video ingestion and basic metadata
- **L1**: Frame-level analysis and feature extraction
- **L2**: Scene segmentation and content understanding
- **L3**: Semantic relationships and cross-video connections

---

## Distributed Capture Network Topology
### 🐳 Docker Compose Service Topology


Our camera proxy peer provides video for straight away use.
Our capture daemon does two things with a one provided (video capture):
- Captures the full quality to media store (recording)
- Presents itself live (live-preview pre-recording)

One frontend is always available either by means of:
- full scale web-app browswer
- camera proxy peer's embedded browser viewer (not full web-app still frontend none the less)

camera proxies are ephemeral and stateless
capture daemon aims to be stateless at its core with persistent state

#### Latest

```mermaid
flowchart TB
  subgraph EDGE["Edge Layer - Camera Proxy Peers"]
    direction LR
    P1["camera-proxy-1<br/>ephemeral/stateless<br/>direct video provision"]
    P2["camera-proxy-2<br/>ephemeral/stateless<br/>direct video provision"] 
    P3["camera-proxy-N<br/>ephemeral/stateless<br/>direct video provision"]
    
    P1 -.-> EV1["embedded viewer"]
    P2 -.-> EV2["embedded viewer"]
    P3 -.-> EV3["embedded viewer"]
  end

  subgraph CORE["Core Ring - Capture Daemon DFS Nodes"]
    direction TB
    CD1["capture-daemon-1<br/>stateless core + persistent state<br/>• record to media store<br/>• live preview service"]
    CD2["capture-daemon-2<br/>stateless core + persistent state<br/>• record to media store<br/>• live preview service"]
    CD3["capture-daemon-3<br/>stateless core + persistent state<br/>• record to media store<br/>• live preview service"]
    
    CD1 <-.-> CD2
    CD2 <-.-> CD3  
    CD3 <-.-> CD1
  end

  subgraph FRONTEND["Frontend Access Patterns"]
    WEB["Full Web App<br/>Browser Interface"]
    EMBED["Embedded Viewers<br/>camera-proxy local"]
  end

  subgraph STORAGE["Persistent Storage"]
    MEDIA["Media Store<br/>(full quality recordings)"]
    LIVE["Live Preview Service<br/>(preprocessed streams)"]
  end

  subgraph CLOUD["ThatDAMPlatform Cloud"]
    GW["API Gateway"]
    SFU["Live SFU (WHIP/WHEP)"]
    APP["Web Dashboard"]
  end

  %% Edge to Core data flows
  P1 -->|video ingress| CD1
  P2 -->|video ingress| CD2
  P3 -->|video ingress| CD3
  
  %% Core ring distributed storage
  CD1 --> MEDIA
  CD2 --> MEDIA
  CD3 --> MEDIA
  
  %% Core ring live services
  CD1 --> LIVE
  CD2 --> LIVE
  CD3 --> LIVE
  
  %% Frontend access paths
  WEB --> CORE
  EV1 & EV2 & EV3 --> EMBED
  
  %% Cloud integration
  CORE -->|record & ingest| GW
  P1 & P2 & P3 -->|WHIP publish| SFU
  APP -->|HTTPS| GW
  APP -->|WHEP view| SFU
  WEB <-.-> APP
  
  classDef edge fill:#FFE0E0,stroke:#D32F2F,stroke-width:2px
  classDef core fill:#E3F2FD,stroke:#1976D2,stroke-width:2px
  classDef frontend fill:#F3E5F5,stroke:#7B1FA2,stroke-width:2px
  classDef storage fill:#E8F5E8,stroke:#388E3C,stroke-width:2px
  classDef cloud fill:#FFF3E0,stroke:#F57C00,stroke-width:2px
  
  class P1,P2,P3 edge
  class CD1,CD2,CD3 core
  class WEB,EMBED,EV1,EV2,EV3 frontend
  class MEDIA,LIVE storage
  class GW,SFU,APP cloud
``` 

---

#### Legacy v0.1.0

```mermaid
flowchart LR
  %% Groups
  subgraph INPUT["Input Sources"]
    USB["USB cameras\n/dev/video*"]
    IP["IP cameras"]
    SCREEN["Screen capture"]
  end

  subgraph HOST["Host Services"]
    CAPTURE["capture-daemon\nrecording + device control"]
    PROXY["camera-proxy\nenumerate & proxy"]
    AGENT["camera-agent\nedge push producer"]
    DISC["discovery\nmDNS / Serf / Tailscale"]
  end

  subgraph LIVE["Live Distribution"]
    SFU["mini-SFU\nWHIP publish / WHEP play\npass-through"]
  end

  subgraph BACKEND["Backend Services"]
    GW["api-gateway"]
    MIA["media-api"]
  end

  subgraph INFRA["Infrastructure"]
    MQ["RabbitMQ"]
    STORE["Media storage"]
    NGX["Nginx / HTTP entry"]
    VIEW["Viewers (browsers / players)"]
  end

  %% Paths
  USB --> CAPTURE
  USB --> PROXY
  IP  --> PROXY
  SCREEN --> CAPTURE

  PROXY --> GW
  AGENT --> GW

  CAPTURE -- "WHIP" --> SFU
  AGENT   -- "WHIP" --> SFU
  VIEW    -- "WHEP" --> SFU

  CAPTURE --> STORE
  CAPTURE --> MQ
  MQ --> VIA
  VIA --> STORE
  GW --> VIA
  GW --> MIA
  NGX --> GW

  %% Styles (keep to safe properties)
  classDef svc fill:#ECF3FF,stroke:#1E88E5,stroke-width:1px;
  classDef live fill:#FFF3E0,stroke:#FB8C00,stroke-width:1px;
  classDef infra fill:#E8F5E9,stroke:#43A047,stroke-width:1px;

  class CAPTURE,PROXY,AGENT,DISC,GW,VIA,MIA svc;
  class SFU live;
  class MQ,STORE,NGX,VIEW infra;
```

---

#### Legacy v0.0.0

```mermaid
graph RL
    subgraph "Input Sources"
        CAM[IP Cameras<br/>Network Sources]
        FILES[Video Files<br/>Local Storage]
        UPLOAD[Upload Sources<br/>HTTP/API]
        BACKUP[Backup Sources<br/>External Storage]
    end

    subgraph "Network Devices (No /dev/ entries)"
        ETH[eth0<br/>Network Interface]
        DOCKER[docker0<br/>Bridge Interface]
        LO[lo<br/>Loopback Interface]
        
        NET_PROPS["✓ Socket-based access<br/>✓ TCP/UDP protocols<br/>✓ High bandwidth<br/>✓ Concurrent connections<br/>✗ Network dependent"]
    end

    subgraph "Character Devices (/dev/c)"
        RANDOM["/dev/random<br/>Entropy Source"]
        NULL["/dev/null<br/>Null Device"]
        STDIN["/dev/stdin<br/>Standard Input"]
        
        CHAR_PROPS["✓ Sequential access<br/>✓ Real-time streaming<br/>✓ Low latency<br/>✗ No random access<br/>✗ No seeking"]
    end

    subgraph "Block Devices (/dev/b)"
        SSD["/dev/sda<br/>Primary Storage"]
        BACKUP_DISK["/dev/sdb<br/>Backup Storage"]
        LOOP["/dev/loop0<br/>Loop Device"]
        
        BLOCK_PROPS["✓ Random access<br/>✓ High throughput<br/>✓ Kernel caching<br/>✓ Batch operations<br/>✗ Higher latency"]
    end

    subgraph "Virtual/Pseudo Devices"
        SHM["/dev/shm<br/>Shared Memory"]
        PROC["/proc<br/>Process Info"]
        SYS["/sys<br/>System Info"]
        
        VIRTUAL_PROPS["✓ Memory-mapped<br/>✓ Process communication<br/>✓ System monitoring<br/>✓ Fast IPC"]
    end

    subgraph "Video API Application (Docker Container)"
        API[Video API Server<br/>Port 8080<br/>Uvicorn/FastAPI]
        
        subgraph "API Endpoints"
            MOTION["/motion/extract<br/>Motion Detection"]
            SCAN["/scan<br/>File Discovery"]
            SEARCH["/search<br/>Content Search"]
            BATCHES["/batches<br/>Batch Processing"]
            BACKUP_EP["/backup<br/>Backup Operations"]
            SYNC["/sync_album<br/>Album Sync"]
            PATHS["/paths<br/>Path Management"]
            JOBS["/jobs<br/>Job Monitoring"]
        end
        
        subgraph "Processing Modules"
            MOTION_EXT[Motion Extractor<br/>Video Analysis]
            FILE_SCAN[File Scanner<br/>Directory Traversal]
            METADATA[Metadata Extractor<br/>Video Properties]
            BATCH_PROC[Batch Processor<br/>Queue Management]
        end
    end

    subgraph "Data Flow Patterns"
        STREAMING["Network Streaming<br/>Real-time video input<br/>Socket connections"]
        BATCH_STORAGE["Batch Storage<br/>File-based processing<br/>Block device I/O"]
        MEMORY_IPC["Memory IPC<br/>Process communication<br/>Shared memory"]
    end

    %% Input Connections
    CAM --> ETH
    FILES --> SSD
    UPLOAD --> DOCKER
    BACKUP --> BACKUP_DISK
    
    %% Network Device Connections
    ETH --> API
    DOCKER --> API
    LO --> API
    
    %% Character Device Connections
    RANDOM --> API
    NULL --> API
    STDIN --> API
    
    %% Block Device Connections
    SSD --> FILE_SCAN
    BACKUP_DISK --> BACKUP_EP
    LOOP --> METADATA
    
    %% Virtual Device Connections
    SHM --> MOTION_EXT
    PROC --> JOBS
    SYS --> SCAN
    
    %% API Endpoint Connections
    API --> MOTION
    API --> SCAN
    API --> SEARCH
    API --> BATCHES
    API --> BACKUP_EP
    API --> SYNC
    API --> PATHS
    API --> JOBS
    
    %% Processing Module Connections
    MOTION --> MOTION_EXT
    SCAN --> FILE_SCAN
    SEARCH --> METADATA
    BATCHES --> BATCH_PROC
    
    %% Data Flow Classification
    ETH --> STREAMING
    DOCKER --> STREAMING
    CAM --> STREAMING
    
    SSD --> BATCH_STORAGE
    BACKUP_DISK --> BATCH_STORAGE
    FILES --> BATCH_STORAGE
    
    SHM --> MEMORY_IPC
    PROC --> MEMORY_IPC
    SYS --> MEMORY_IPC
    
    %% Property connections
    ETH -.-> NET_PROPS
    RANDOM -.-> CHAR_PROPS
    SSD -.-> BLOCK_PROPS
    SHM -.-> VIRTUAL_PROPS

    %% Docker Container Context
    subgraph "Docker Container Context"
        CGROUP[Container cgroups<br/>Device Access Control]
        NAMESPACE[Network Namespace<br/>Isolated Networking]
        MOUNT[Mount Namespace<br/>Filesystem Isolation]
    end
    
    CGROUP --> SSD
    CGROUP --> BACKUP_DISK
    NAMESPACE --> ETH
    NAMESPACE --> DOCKER
    MOUNT --> SHM
    MOUNT --> PROC

    %% Styling
    classDef networkDevice fill:#e3f2fd,stroke:#000,stroke-width:2px,color:#000
    classDef charDevice fill:#e1f5fe,stroke:#0277bd,stroke-width:2px,color:#000
    classDef blockDevice fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000
    classDef virtualDevice fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef application fill:#fff3e0,stroke:#ef6c00,stroke-width:2px,color:#000
    classDef dataFlow fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef properties fill:#fafafa,stroke:#616161,stroke-width:1px,font-size:10px,color:#000
    classDef docker fill:#f1f8e9,stroke:#558b2f,stroke-width:2px,color:#000
    
    class ETH,DOCKER,LO networkDevice
    class RANDOM,NULL,STDIN charDevice
    class SSD,BACKUP_DISK,LOOP blockDevice
    class SHM,PROC,SYS virtualDevice
    class API,MOTION,SCAN,SEARCH,BATCHES,BACKUP_EP,SYNC,PATHS,JOBS,MOTION_EXT,FILE_SCAN,METADATA,BATCH_PROC application
    class STREAMING,BATCH_STORAGE,MEMORY_IPC dataFlow
    class NET_PROPS,CHAR_PROPS,BLOCK_PROPS,VIRTUAL_PROPS properties
    class CGROUP,NAMESPACE,MOUNT docker
    
    subgraph "Character Devices (/dev/c)"
        RANDOM["/dev/random<br/>Entropy Source"]
        NULL["/dev/null<br/>Null Device"]
        STDIN["/dev/stdin<br/>Standard Input"]
        VIDEO0["/dev/video*<br/>Camera Nodes"]
        V4L2REQ["cgroup rule: 81:* rmw"]
        
        CHAR_PROPS["✓ Sequential access<br/>✓ Real-time streaming<br/>✓ Low latency<br/>✗ No random access<br/>✗ No seeking"]
    end

    VIDEO0 --> API
    V4L2REQ --> VIDEO0
    RANDOM -.-> CHAR_PROPS
    NULL   -.-> CHAR_PROPS
    STDIN  -.-> CHAR_PROPS


    class RANDOM,NULL,STDIN,VIDEO0,V4L2REQ charDevice
``` 

---

### API Endpoints

```mermaid
graph TD;
  CLI["video/ (CLI)"] -->|same code| API(FastAPI svc);
  API -->|JSON| VanillaWeb[Vanilla JS Dashboard];
  API -->|JSON| Streamlit[Optional Streamlit svc];
  subgraph Storage
    SMB[Workspace /mnt/b/] & NAS[Archive /mnt/nas/]
  end
  SMB & NAS --> HostBindMount
  HostBindMount -->|bind mounts| API
``` 

The FastAPI server provides comprehensive REST endpoints:

- `/motion/extract` - Motion Detection & Analysis
- `/scan` - File Discovery & Indexing
- `/search` - Content Search & Filtering
- `/batches` - Batch Processing Management
- `/backup` - Backup Operations
- `/sync_album` - Album Synchronization
- `/paths` - Path Management
- `/jobs` - Job Monitoring & Status

--- 

## Hardware Context

### Device Integration Matrix

The system integrates with various hardware and virtual devices for optimal performance:

```mermaid
graph RL
    subgraph "Input Sources"
        CAM[IP Cameras<br/>Network Sources]
        FILES[Video Files<br/>Local Storage]
        UPLOAD[Upload Sources<br/>HTTP/API]
        BACKUP[Backup Sources<br/>External Storage]
    end

    subgraph "Network Devices"
        ETH[eth0 - Network Interface]
        DOCKER[docker0 - Bridge Interface]
        LO[lo - Loopback Interface]
    end

    subgraph "Character Devices (/dev/c)"
        VIDEO0["/dev/video* - Camera Nodes"]
        RANDOM["/dev/random - Entropy Source"]
        NULL["/dev/null - Null Device"]
    end

    subgraph "Block Devices (/dev/b)"
        SSD["/dev/sda - Primary Storage"]
        BACKUP_DISK["/dev/sdb - Backup Storage"]
        LOOP["/dev/loop0 - Loop Device"]
    end

    subgraph "API Application"
        API[Video API Server<br/>Port 8080<br/>FastAPI/Uvicorn]
    end

    CAM --> ETH
    FILES --> SSD
    UPLOAD --> DOCKER
    BACKUP --> BACKUP_DISK
    VIDEO0 --> API
    ETH --> API
    SSD --> API
```

---

## Architecture Overview

This system provides a multi-layered video processing architecture with clean service boundaries. The **api-gateway** serves as the main entry point, handling all client traffic and proxying to backend services. Host-level services like **camera-proxy** provide device virtualization (exposing cameras to containers without mounts), while **capture-daemon** handles continuous FFmpeg recording. The **pipeline-manager** enables advanced video processing through virtual devices and named pipes.

All services share common middleware for authentication, rate limiting, logging, and caching. The architecture separates concerns cleanly: gateway handles routing and middleware, proxy services manage device access, and capture services handle media processing—all while keeping containers device-agnostic.

### System Flow

#### Latest

```mermaid
sequenceDiagram
  autonumber
  participant D as discovery
  participant P as publisher (capture-daemon or camera-agent)
  participant CP as camera-proxy
  participant G as api-gateway
  participant S as mini-SFU (WHIP/WHEP)
  participant V as viewers
  participant MQ as RabbitMQ
  participant M as media-api
  participant ST as storage

  D->>D: Probe mDNS / Serf / Tailscale
  alt No gateway found
    D->>P: Select SERVER mode (enable capture + infra)
  else Gateway present
    D->>CP: Select PROXY mode (enumerate & proxy)
  end

  par Live distribution
    P--)S: WHIP publish (H.264 pass-through)
    V--)S: WHEP subscribe
    S--)V: Stream to viewers
  and Archival + AI
    P->>ST: Write master files (ProRes/FFV1)
    P->>MQ: Emit capture.* events
    MQ->>B: Enqueue L1–L3 jobs
    B->>ST: Thumbnails / previews / metadata
  end

  CP->>G: /api/devices, /stream
  G->>B: Route API calls
``` 

#### Legacy

```mermaid
graph TB
    subgraph "Client Layer"
        Client[HTTP Client/Browser]
    end

    subgraph "Gateway Layer"
        Gateway[api-gateway:8080]
        Proxy[proxy]
    end

    subgraph "Host Services"
        CameraProxy[camera-proxy:8000]
        CaptureDaemon[capture-daemon:9000]
        PipelineManager[poc_video-pipeline-manager]
    end

    subgraph "Backend Services"
        Backend[Python API Backend]
        Static[Static SPA Files]
    end

    subgraph "System Resources"
        Devices["/dev/video* USB Cameras"]
        Storage[Disk Storage]
        VirtualDevices[v4l2loopback Virtual Devices]
    end

    subgraph "Shared Components"
        Middleware[shared/middleware]
        Utils[shared/utils]
        Types[shared/types]
    end

    Client --> Gateway
    Client --> Proxy
    
    Gateway --> CameraProxy
    Gateway --> Backend
    Gateway --> Static
    
    Proxy --> Backend
    
    CameraProxy --> Devices
    CaptureDaemon --> Devices
    CaptureDaemon --> Storage
    PipelineManager --> VirtualDevices
    
    Gateway -.-> Middleware
    CameraProxy -.-> Middleware
    CaptureDaemon -.-> Middleware
    Proxy -.-> Middleware
    
    Middleware --> Utils
    Middleware --> Types
``` 
⸻

## How the Flow Works
### End-to-End Flow Example:
```mermaid
sequenceDiagram
    participant Client as HTTP Client
    participant Gateway as api-gateway:8080
    participant Proxy as camera-proxy:8000
    participant Daemon as capture-daemon:9000
    participant Pipeline as video-pipeline-manager
    participant Device as Camera Device

    Note over Client,Device: System Initialization
    Proxy->>Device: Discover v4l2/USB cameras
    Daemon->>Device: Scan available devices
    Pipeline->>Pipeline: Setup virtual device graphs

    Note over Client,Device: Client Requests
    Client->>Gateway: GET /api/video/
    Gateway->>Proxy: Proxy API request
    Proxy->>Client: Return response via Gateway

    Client->>Gateway: GET /stream/:device
    Gateway->>Proxy: Route stream request
    Proxy->>Device: Access camera stream
    Device->>Proxy: Video stream data
    Proxy->>Gateway: Stream video
    Gateway->>Client: Live video stream

    Client->>Gateway: WebSocket /ws/
    Gateway->>Proxy: Upgrade to WebSocket
    Proxy->>Device: Device control commands
    Device->>Proxy: Device status/data
    Proxy->>Client: Real-time updates via Gateway

    Note over Client,Device: Background Operations
    Daemon->>Device: Continuous capture
    Device->>Daemon: Video frames
    Daemon->>Daemon: FFmpeg processing to disk

    Pipeline->>Device: Route processed frames
    Pipeline->>Pipeline: Manage named-pipe routing
    Pipeline->>Pipeline: Support ML/inference apps
``` 

⸻

#### DevOps & Composability
- Each service can be run as a standalone systemd service or orchestrated in a minimal Compose/Podman/Docker Compose stack. You do not need to bind-mount devices into your containers.
- Infra upgrades, extensions, and migration: Drop-in additional pipeline processors, swap out middlewares, and swap from POC to production ready by extending only the parts you care about.
- Frontends can remain "dumb" and make fetch calls to the same endpoints (the API gateway abstracts everything).

⸻

#### How to Extend or Productionize
- Security: Harden JWT, implement real validateJWT, remove dev-mode CORS and CheckOrigin: true.
- Monitoring: Add metrics middleware, Prometheus endpoints, journal logs, proper log rotation.
- Error handling: Ensure all device errors are surfaced through API/WS responses, not just logs.
- Config management: Use .env files, config maps, or secrets for all paths, keys, intervals.
- Add tests: System/integration/e2e tests per service.
- API Versioning: Add /v1/ routes for long-term contract stability.
- Modular runners: Each camera runner could push frames to a message bus (NATS, MQTT, etc.) for plug-and-play downstream processing (AI, cloud upload, etc).


---

## Installation

### Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/Cdaprod/ThatDAMToolbox/main/scripts/install.sh | sudo bash
```

The script auto-detects the Raspberry Pi architecture, downloads the latest
release binaries, and installs them to `/usr/local/bin`.

### Prerequisites

- Python 3.8+
- Docker (recommended)
- FFmpeg
- CUDA-capable GPU (optional, for AI acceleration)

### Docker Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/Cdaprod/ThatDAMToolbox.git
cd ThatDAMToolbox

# Build Go service images (run from repo root)
# Start BuildKit daemon for persistent caching
docker compose up -d buildkit
docker compose build overlay-hub supervisor runner

# Build and run with Docker Compose
docker compose up -d

# Access the web interface
open http://localhost:8080
```

To store data under a different host path, override `DATA_ROOT`:

```bash
DATA_ROOT=/srv/dam-data docker compose -f docker/compose/docker-compose.media-api.yaml up -d
```

### Prepare data directories before launch

Use the platform hook to create required directories with correct
ownership before starting services:

```bash
scripts/run_with_dirs.sh /var/lib/thatdamtoolbox/db /var/lib/thatdamtoolbox/media -- docker-compose up -d
```

The helper invokes `ensure-dirs` from `host/shared/platform`, making the operation idempotent.

### Manual Installation

```bash
# Start Go media-api
go run ./host/services/media-api/cmd/media-api serve --addr :8080

# Start the server
uvicorn video.server:app —host 0.0.0.0 —port 8080
```

## Quick Start

### Basic Usage

```python
from video import MediaIndexer

# Initialize the indexer
indexer = MediaIndexer()

# Scan a directory
indexer.scan("/path/to/media")

# Get recent files
recent_media = indexer.get_recent()

# Search content
results = indexer.search("sunset beach")
```

### Upstream Configuration

The gateway falls back to `127.0.0.1:8080` when no upstream is specified. Override
`UPSTREAM` (or `UPSTREAM_HOST`/`UPSTREAM_PORT`) to point elsewhere:

```bash
export UPSTREAM=127.0.0.1:8080
```

The entrypoint automatically splits this into `UPSTREAM_HOST` and `UPSTREAM_PORT`
and fails fast if the host cannot be resolved.

### Web Interface

1. Navigate to `http://localhost:8080`
1. Drop media files or folders onto the interface
1. Monitor processing progress in real-time
1. Search and explore your indexed content

### Workflow Automation

Create JSON workflows for complex operations:

```json
{
  "workflow": [
    {
      "action": "sync_album",
      "root": "/media/workspace",
      "album": "Project Alpha",
      "category": "edit",
      "copy": true
    },
    { "action": "scan", "root": "/media/incoming" },
    { "action": "backup", "backup_root": "/media/archive" },
    { "action": "stats" }
  ]
}
```

## Deployment & Environments

See [README-DEPLOY](README-DEPLOY.md) for a command cheat sheet and
[docs/TECHNICAL/environments.md](docs/TECHNICAL/environments.md) for
details on dev, edge, and prod flows.

## API Documentation

### Core Endpoints

#### Scan Media Directory

```http
POST /scan?dir=/path/to/media
```

#### Ingest Video for AI Processing

```http
POST /api/embedding/videos/ingest
Content-Type: application/json

{
  "path": "/media/video.mp4",
  "generate_levels": ["L1", "L2", "L3"]
}
```

#### Search Content

```http
GET /search?q=sunset+beach&type=video
```

#### Get Processing Status

```http
GET /jobs/{job_id}/status
```

## Development Roadmap

### Current Progress

#### ✅ Completed

- [x] **Hierarchical Video Embedding System** - Multi-layer AI processing
- [x] **Hero + Witness Cam Tracker Export** - VFX pipeline integration
- [x] **iPhone Photos Ingestion** - HEIC/ProRes batch processing
- [x] **Stock Video Curation** - Rating and licensing workflows
- [x] **AI Batch Metadata Packaging** - XML/CSV sidecar generation
- [x] **Bulk Stock Platform Publishing** - Automated distribution
- [x] **Abstract Base Models & Artifact Factory** - Domain modeling framework
- [x] **Vanilla Frontend Browser API** - Card-based web interface
- [x] **Next.js Frontend** - Production Ready Web Browser App
- [x] **Network Media Sync** - SMB/NAS/cloud integration
- [x] **Deep Media Probe** - Advanced codec and EXIF analysis 
- [x] **Websocket + WebRTC** - Frontend implmentation
- [x] **Realtime Overlays** - False Color, Zebras, Focus Peaking
- [x] **Monitor Multiple Cameras** - Indexes devices & hot plug/swap persistent
- [x] **Web App Video Results** - Mjpeg preview of feeds in browser api endpoint 

#### 🚧 In Progress

- [ ] **Frontend Web Site** - Decoupled from any "apps"
- [ ] **Refactor FastAPI to Golang** - See [media-app](/host/services/media-app)
- [ ] **Platform as a Service implementation** - Users, JWT, Systems, Etc
- [ ] 

#### 📋 Planned

- [ ] **Audio-Waveform Sync** - Multi-cam align ent
- [ ] **Speech-to-Text + Captions** - Advanced transcription
- [ ] **Batch Media → Blender Integration** - Dire t scene injection
- [ ] **Dialogue/Music Separation** - AI-powere  audio processing
- [ ] **End-to-End Media Lifecycle** - Comp ete workflow automation

## Directory Structure

```
vid o/
├── __init__.py          # Main module
├── db.py           x   # Database in erfxce
├── scanner.py          # Fil  scanning logic  
├── sync.py             # Photo sync integrati n
├── schema.sql          # Database schema
├── web/               # Web interf ce
│   ├── static/        # CSS, JS, assets
│   └── templates/     # HTML templates
├── api/      x        # API modules
│   ├── embedding/     # AI p ocessing
│   └── motion/        # Computer vision
└── worker /           # Background processors
```

## Contributing

We welcomexcontributions! Please see our [Contributing Guidelines](CONTRIBUT NG.md) for details.

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/yourusername/ThatDAMToolbox.git

# Create development environment
python -m venv venv
source venv/bin/activate

# Install development dependencies
pip install -r requirements-dev.txt

# Run tests
pytest tests/

# Start development server
uvicorn video.server:app --reload
```

## License

This project is licensed under the MIT License - see the <LICENSE> file for details.

-----

<div align="center">

**Built with ❤️ by [David Cannan](https://github.com/Cdaprod)**

*Transforming how we discover, process, and manage digital media through AI*

</div>
