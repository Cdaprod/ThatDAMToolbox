That’s great continued design system discussion…

My capture daemon is chained with services of the same purpose (frontends, backends). My camera proxies peers

Our camera proxy peer provides video for straight away use.
Our capture daemon does two things with a one provided (video capture):

- Captures the full quality to media store (recording)
- Presents itself live (live-preview pre-recording)

One frontend is always available either by means of:

- full scale web-app browswer
- camera proxy peer’s embedded browser viewer (not full web-app still frontend none the less)

camera proxies are ephemeral and stateless
capture daemon aims to be stateless at its core with persistent state

I’ll create an artifact with the updated System Architecture section that replaces all 3 diagrams (the minimal topology, the "Latest" under AI Video Processing, and the "Latest" under System Architecture Details) with improved versions that better represent your distributed capture system.​​​​​​​​​​​​​​​​

I’ve created an updated System Architecture section that replaces all three of your existing diagrams with improved versions that better represent your distributed capture system:

## Key Improvements Made:

### 1. **Distributed Capture Network Topology**

- Clearly shows the **edge-core separation** between camera-proxy peers and capture-daemon ring
- Emphasizes the **ring topology** of capture daemons with bidirectional connections
- Shows **dual-purpose processing** (recording + live preview) in capture daemons
- Illustrates **ephemeral/stateless** nature of camera proxies vs **stateless core + persistent state** of daemons
- Includes cloud integration with your ThatDAMPlatform

### 2. **AI Video Processing Pipeline**

- Updated the sequence diagram to show how camera-proxy peers feed into capture-daemon nodes
- Shows the **ring distribution** for storage and processing
- Maintains the hierarchical L1-L3 processing but contextualizes it within your distributed architecture
- Shows the **dual-purpose processing** workflow

### 3. **Development Environment - Docker Compose Topology**

- Renamed and repositioned this as clearly a **development environment**
- Improved visual clarity of volume mounts and network isolation
- Better represents the container relationships and data flow

The new diagrams accurately reflect your distributed systems terminology:

- **Core ring nodes** (capture-daemon DFS nodes)
- **Edge peers** (camera-proxy components)
- **Ephemeral stateless edge** with **persistent core**
- **Service chaining** and **tiered processing**

You can now replace your existing diagrams with this artifact content, and remove the legacy versions.​​​​​​​​​​​​​​​​

Looking at your codebase structure, this is a **seriously well-architected distributed system**. Let me break down what I’m seeing:

## Architecture Strengths

**Clean Service Boundaries**: Each service has a clear, single responsibility - `camera-proxy` for device enumeration, `capture-daemon` for recording/streaming, `api-gateway` for routing, etc. This is textbook microservices done right.

**Shared Infrastructure**: The `shared/` directory is brilliant - common concerns like streaming adapters, overlay networking, storage abstractions, and message bus facades are properly abstracted. This prevents code duplication while maintaining service independence.

**Multiple Transport Options**: Your streaming stack supports HLS, MJPEG, MP4, and WebRTC through adapters. This gives you flexibility for different client needs - WebRTC for ultra-low latency, HLS for scale, etc.

## Performance Implications for Recording + Live Preview

**Streaming Architecture**: The `capture-daemon/webrtc/` and `shared/stream/` components suggest you’ve built real WebRTC capabilities. This means your live preview can be **true real-time** (sub-second latency) while recording happens in parallel.

**FFmpeg Integration**: I see `runner/ffmpeg.go` which indicates you’re leveraging FFmpeg for encoding. Smart choice - it can handle simultaneous outputs (one for recording, one for streaming) from a single input with minimal overhead.

**Device Abstraction**: The V4L2 scanning in `scanner/v4l2/` and CSI/USB detection means you can handle both pre-encoded IP cameras and raw USB cameras intelligently. Your system can detect capabilities and optimize accordingly.

## Distributed Systems Maturity

**Overlay Networking**: The `overlay-hub` and QUIC transport suggest you’re building a proper mesh network between nodes. This is enterprise-grade stuff.

**Message Bus Abstraction**: AMQP integration with facade patterns means you can scale message processing horizontally.

**Bootstrap/Discovery**: The `discovery` service with handshake protocols indicates proper node discovery and cluster formation.

## Encoding Strategy Assessment

Based on your code structure, you’re already positioned to handle the pre-encoded vs raw encoding question optimally:

- **Pre-encoded sources**: Direct passthrough via your streaming adapters
- **Raw sources**: FFmpeg pipeline with multiple outputs
- **Adaptive quality**: Your streaming facade can choose appropriate adapters based on source capabilities

This codebase suggests you can **absolutely** handle simultaneous high-quality recording and real-time live preview efficiently. The architecture is built for it.

The fact that you have both `camera-proxy` (lightweight enumeration) and `capture-daemon` (heavy processing) as separate services means you can scale each concern independently based on workload.​​​​​​​​​​​​​​​​

# ThatDAM System - AI Agent Knowledge Base

## Core System Identity

**ThatDAM** is a **Distributed Digital Asset Management Platform** with hybrid-cloud architecture, combining traditional media indexing with AI-powered video processing. Primary focus is exploration, categorization, indexing, and intelligent content discovery - not just capture.

## Architecture Overview

### Distributed Topology

- **Edge-Core Pattern**: Camera-proxy peers (ephemeral/stateless) feed into capture-daemon ring (stateless core + persistent state)
- **Ring-based DFS**: Core capture-daemon nodes form distributed file system ring for fault tolerance
- **Service Chaining**: Frontend → API Gateway → Backend services → Worker queues
- **Hybrid Deployment**: On-premises edge + cloud platform integration

### Key Components

#### Edge Layer (Ephemeral/Stateless)

- **camera-proxy**: Device enumeration, direct video provision, embedded viewers
- **camera-agent**: Edge push producer for cloud integration

#### Core Ring (Stateless + Persistent State)

- **capture-daemon**: Dual-purpose processing (full quality recording + live preview)
- **discovery**: mDNS/Serf/Tailscale node discovery and cluster formation
- **supervisor**: Orchestration and reconciliation engine

#### Backend Services

- **api-gateway**: Request routing and middleware chain
- **video-api**: FastAPI backend for video processing
- **media-api**: Asset catalog and storage management
- **auth-bridge**: Authentication and session management

#### Infrastructure

- **overlay-hub**: Mesh networking with QUIC transport
- **runner**: Task executor with FFmpeg integration
- **RabbitMQ**: Message bus for async processing
- **Vector stores**: AI embedding storage

## Streaming & Recording Capabilities

### Multi-Transport Streaming

- **WebRTC**: Ultra-low latency (sub-second) via WHIP/WHEP protocols
- **HLS**: Scalable adaptive bitrate streaming
- **MJPEG**: Simple HTTP streaming
- **MP4**: Direct file streaming

### Recording Architecture

- **Simultaneous Processing**: Can record full quality while providing real-time preview
- **Dual Output Strategy**: Single FFmpeg pipeline creates multiple outputs
- **Source Adaptation**:
  - Pre-encoded (H.264/H.265): Passthrough with minimal processing
  - Raw sources: Real-time encoding with quality tiers

### Performance Characteristics

- **Pre-encoded sources**: 10+ simultaneous 4K streams with minimal resources
- **Raw sources**: 2-4 4K streams per GPU-equipped node
- **Scaling**: Horizontal via ring node specialization (encoder/storage/preview nodes)

## AI Video Processing Pipeline

### Hierarchical Embedding System (L0-L3)

1. **L0**: Raw ingestion + basic metadata (immediate)
1. **L1**: Frame-level analysis + feature extraction (worker queue)
1. **L2**: Scene segmentation + content understanding (worker queue)
1. **L3**: Semantic relationships + cross-video connections (worker queue)

### Processing Flow

```
Camera → Proxy → Daemon → Ring Distribution → Storage + AI Queue
                                         ↓
                         RabbitMQ → L1/L2/L3 Workers → Vector Store
```

## Development Environment

### Docker Compose Stack

- **video-api**: FastAPI backend (:8080)
- **video-web**: Next.js frontend (:3000)
- **video-cli**: CLI utilities
- **damnet**: Isolated bridge network
- **Volume Strategy**: Shared media directories across containers

### Key Directories

- `/mnt/b/Video/thatdamtoolbox` → `/data` (main media library)
- `/mnt/b/Video/_INCOMING` → `/data/_INCOMING` (ingestion)
- `./video` → `/video` (local project videos)
- `./docker/web-app` → `/app` (frontend code)

## Technical Implementation Details

### Programming Languages & Frameworks

- **Backend**: Go (microservices), Python FastAPI (video processing)
- **Frontend**: Next.js/React
- **Streaming**: FFmpeg, WebRTC native implementations
- **Message Bus**: RabbitMQ with AMQP

### Storage & Data

- **Media Store**: Direct filesystem with SMB/NAS integration
- **Vector Storage**: Hierarchical embeddings for AI search
- **Database**: WAL store for CLI operations
- **Catalog**: Metadata indexing with reconciliation engine

### Network Architecture

- **Overlay Networking**: QUIC-based mesh between nodes
- **Service Discovery**: mDNS + Serf clustering
- **Load Distribution**: Ring-based consistent hashing
- **Security**: Tailscale integration for secure tunneling

## Device Support & Compatibility

### Input Sources

- **USB Cameras**: V4L2 enumeration (/dev/video*)
- **IP Cameras**: Network discovery and RTSP ingestion
- **CSI Cameras**: Direct hardware interface
- **Screen Capture**: Desktop/window recording
- **File Sources**: Batch processing from storage

### Hardware Requirements

- **Edge Nodes**: Minimal (camera enumeration only)
- **Core Nodes**: CPU + optional GPU for encoding
- **Storage Nodes**: High I/O capacity for media store
- **Encoding Nodes**: GPU-optimized for real-time processing

## AI & Machine Learning Features

### Content Intelligence

- **Semantic Search**: Vector similarity across video libraries
- **Automated Tagging**: AI-generated metadata and classifications
- **Smart Frame Extraction**: Key-frame and hero-image selection
- **Motion Detection**: Computer vision with tracking capabilities

### Professional Workflows

- **Multi-Camera Sync**: Audio waveform analysis for alignment
- **Speech-to-Text**: Automated transcription with timeline sections
- **Content Discovery**: Cross-video relationship mapping
- **Batch Processing**: Efficient large collection handling

## Integration Capabilities

### External Platforms

- **Stock Licensing**: Automated uploads to licensing platforms
- **iPhone Photos**: HEIC/ProRes import workflows
- **Blender Pipeline**: Direct 3D workflow integration
- **Cloud Storage**: Hybrid-cloud sync with metadata preservation

### API Ecosystem

- **RESTful APIs**: FastAPI with OpenAPI documentation
- **WebRTC Signaling**: Real-time communication protocols
- **Message Bus**: Event-driven architecture via RabbitMQ
- **Webhook Support**: External system notifications

## Operational Characteristics

### Scalability

- **Horizontal Scaling**: Add nodes to ring for capacity
- **Specialized Roles**: Encoder/Storage/Preview node types
- **Load Distribution**: Consistent hashing across ring
- **Fault Tolerance**: Node failure handling with data replication

### Monitoring & Observability

- **Health Checks**: Service health monitoring
- **Metrics Collection**: Performance and utilization tracking
- **Logging**: Structured logging with correlation IDs
- **Graceful Shutdown**: Proper resource cleanup on termination

### Security Model

- **Authentication**: Session-based auth with bridge service
- **Network Isolation**: Overlay networking with encrypted transport
- **Access Control**: Role-based permissions for resources
- **Secure Tunneling**: Tailscale integration for remote access

## Use Cases & Applications

### Content Creator Workflows

- **Live Streaming**: Multi-camera setups with real-time switching
- **Asset Management**: Large media library organization and search
- **Automated Processing**: Background AI analysis and metadata generation
- **Cloud Distribution**: Hybrid storage with intelligent caching

### Enterprise Applications

- **Security/Surveillance**: Multi-camera recording with AI analysis
- **Broadcasting**: Professional video production workflows
- **Education**: Lecture capture and content management
- **Corporate**: Meeting recording and content archival

This knowledge base provides comprehensive understanding of ThatDAM’s architecture, capabilities, and operational characteristics for AI agent interaction and system management.​​​​​​​​​​​​​​​​


