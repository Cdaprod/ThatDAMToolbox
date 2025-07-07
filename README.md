# MEDIA INDEXER 
## PYTHONISTA PROTOTYPE
### By David Cannan — Cdaprod

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

## Media-Indexer Bridge & DAM Toolbox -- Feature Matrix
### My Progress
- [x] **Sync network media → app DB**  
      _Scan NAS / SMB / cloud buckets, sync by metadata_
- [x] **Dry-run mode**  
      _Preview every operation for assurance & observability_
- [ ] **Deep media probe**  
      _Detect video-has-audio, extract frame thumbs, gather codec + EXIF_
- [x] **AI metadata enrichment**  
      _Autofill filenames, descriptions, keywords, custom fields_
- [x] **AI still-frame extractor / handler**  
      _Smart key-frame & hero-image selection_
- [x] **Audio-waveform sync**  
      _Line up multi-cam / dual-system audio via waveform analysis_
- [ ] **Speech-to-text + captions**  
      _Transcribe, delete filler words, auto-section timelines_
- [x] **Hero + Witness cam tracker export**  
      _Generate tracking data for VFX pipelines_
- [ ] **Batch media → Blender (network pass-thru)**  
      _Push shots / plates directly into Blender scenes_
- [x] **iPhone Photos ingestion**  
      _Pull & batch-rename HEIC / ProRes clips from Photos app_
- [x] **Stock-video curator**  
      _Rate, tag, and shortlist clips for licensing_
- [ ] **Dialogue / music removal**  
      _Separate stems or produce clean-dialogue tracks_
- [x] **AI batch metadata packager**  
      _Bundle enriched XML / CSV sidecars per agency specs_
- [x] **Bulk publish to stock platforms**  
      _Automate uploads & metadata mapping (e.g., Pond5, Artgrid)_
- [ ] **End-to-end media lifecycle**  
      _Capture → Edit → Publish → Archive--all tracked in one place_

---

# About the web app

```mermaid
graph TD;
  CLI["video/ (CLI)"] -->|same code| API(FastAPI svc);
  API -->|JSON| VanillaWeb[Vanilla JS Dashboard];
  API -->|JSON| Streamlit[Optional Streamlit svc];
  subgraph Storage
    SMB[/mnt/b/] & NAS[/mnt/nas/]
  end
  SMB & NAS --> HostBindMount
  HostBindMount -->|bind mounts| API
``` 

- CLI & FastAPI share the same modules – you just call scan_videos() from either.
- Any UI (vanilla dashboard or Streamlit) only consumes the REST endpoints.

---

This is a logical prototype developed in Pythonista to create the pythonic math I requ ire for indexing media.



---

## Media Indexer - Pure stdlib implementation for Pythonista
Place this in: pythonista/Modules/site-packages(user)/video/

## Directory structure:

```txt
video/
├── __init__.py          # This file
├── db.py               # Database interface
├── scanner.py          # File scanning logic
├── sync.py             # Photo sync integration
└── schema.sql          # Database schema
``` 

## Usage:

```python
from video import MediaIndexer
indexer = MediaIndexer()
indexer.scan()
recent = indexer.get_recent()
```  

## Shortcuts JSON Example

### A. single step

```json
{
  "action": "backup",
  "backup_root": "/Volumes/Media/B/Video/_MASTER"
}
``` 

### B. workflow

```json
{
  "workflow": [
    {
      "action": "sync_album",
      "root": "/Volumes/Media/B/Video",
      "album": "My Album",
      "category": "edit",
      "copy": true
    },
    { "action": "scan",   "root": "/Volumes/Media/B/Video/_INCOMING" },
    { "action": "backup", "backup_root": "/Volumes/Media/B/Video/_MASTER" },
    { "action": "stats" }
  ]
}
``` 