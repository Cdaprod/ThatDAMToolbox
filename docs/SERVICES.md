# SERVICES

## Service Topology (Docker/Host)

```mermaid
flowchart TD
  %% Service Topology (Mermaid 11.5.0-safe)

  %% Clients
  subgraph CLIENTS["Clients"]
    BROWSER["Browser / Mobile"]
    DIRECTOR["Director / Monitor"]
  end

  %% Host (owns :80/:443 via nginx)
  subgraph HOST["Host (host network)"]
    GW["gw (nginx)\n80 / 443"]
    DISC["discovery (conditional)"]
  end

  %% App network
  subgraph DAMNET["damnet (bridge)"]
    APIGW["api-gateway\n:8080"]
    OVERLAY["overlay-hub\n:8090"]
    CAMPROXY["camera-proxy\n:8000"]
    CAPTURE["capture-daemon\n:9000"]
    VAPI["video-api (FastAPI)\n:8080"]
    MAPI["media-api\n:8081→8080"]
    VWEB["video-web (Next.js)\n:3000"]
    WSITE["web-site (Next.js)\n:3001"]
    MQ["rabbitmq\n:5672 / :15672"]
    SFU["mini-SFU (WHIP/WHEP)\npass-through"]
  end

  %% Edge nodes
  subgraph EDGE["Edge Devices"]
    CAGENT["camera-agent\n(edge push)"]
  end

  %% Devices & Storage
  subgraph DEVICES["Devices"]
    V4L2["/dev/video*"]
  end

  subgraph STORAGE["Storage / Volumes"]
    DATA["/data"]
    RECORDS["/records"]
    DBWAL["db_wal"]
    RABBITVOL["rabbitmq_data"]
  end

  %% Client traffic
  BROWSER -->|https| GW
  DIRECTOR -->|https| GW
  GW -->|web| VWEB
  GW -->|api| APIGW
  GW -->|video| VAPI
  GW -->|live| SFU

  %% Intra-service
  APIGW -->|cam-proxy| CAMPROXY
  APIGW -->|video-api| VAPI
  APIGW <-->|auth| OVERLAY
  VWEB -->|rest/ws| APIGW
  WSITE -->|rest| APIGW

  %% Devices and capture
  CAMPROXY <-->|enumerate| V4L2
  CAPTURE  <-->|ffmpeg| V4L2
  CAPTURE  -->|record| RECORDS
  VAPI <-->|media-io| DATA

  %% Live distribution
  CAGENT -->|whip| SFU
  CAPTURE -->|whip| SFU
  BROWSER -->|whep| SFU
  DIRECTOR -->|whep| SFU

  %% Events (AMQP)
  CAPTURE --> MQ
  CAMPROXY --> MQ
  VAPI --> MQ
  OVERLAY --> MQ

  %% Volumes
  MQ --- RABBITVOL
  VAPI --- DBWAL

  %% Discovery hints
  DISC -.-> APIGW
  DISC -.-> CAMPROXY
  DISC -.-> CAPTURE
  DISC -.-> SFU

  %% Styles (kept minimal for compatibility)
  classDef gw fill:#0ea5e9,stroke:#0ea5e9,color:#ffffff,stroke-width:1px;
  classDef api fill:#a855f7,stroke:#a855f7,color:#ffffff,stroke-width:1px;
  classDef svc fill:#ec4899,stroke:#ec4899,color:#ffffff,stroke-width:1px;
  classDef mq  fill:#10b981,stroke:#10b981,color:#ffffff,stroke-width:1px;
  classDef store fill:#94a3b8,stroke:#94a3b8,color:#ffffff,stroke-width:1px;
  classDef device fill:#f59e0b,stroke:#f59e0b,color:#ffffff,stroke-width:1px;
  classDef client fill:#60a5fa,stroke:#60a5fa,color:#ffffff,stroke-width:1px;
  classDef live fill:#fb923c,stroke:#fb923c,color:#ffffff,stroke-width:1px;

  class GW gw
  class APIGW,OVERLAY,VAPI,VWEB,WSITE,MAPI api
  class CAMPROXY,CAPTURE,DISC svc
  class MQ mq
  class DATA,RECORDS,DBWAL,RABBITVOL store
  class V4L2 device
  class BROWSER,DIRECTOR client
  class SFU live
  class CAGENT svc
```

## Live Preview / Capture Request (Sequence)

```mermaid
sequenceDiagram
  autonumber
  participant C as Client (Browser)
  participant GW as gw (nginx)
  participant G as api-gateway
  participant P as Publisher (capture-daemon or camera-agent)
  participant CP as camera-proxy
  participant S as mini-SFU (WHIP/WHEP)
  participant V as video-api
  participant MQ as rabbitmq
  participant ST as storage (/records,/data)

  Note over P,CP: Device discovery & control
  C->>GW: GET /api/devices
  GW->>G: proxy
  G->>CP: enumerate /dev/video*
  CP-->>G: devices
  G-->>C: JSON list

  par Live preview (low-latency)
    P--)S: WHIP publish (H.264 pass-through)
    C--)GW: GET /live/cam1 (WHEP proxy)
    GW--)S: WHEP subscribe
    S--)C: stream to browser
  and Archival + indexing
    P->>ST: write master file (/records/*.mov|mp4)
    P->>MQ: publish capture.started
    MQ->>V: queue ingest/index
    V->>ST: thumbnails / previews / metadata
    V-->>G: status / search results
  end
``` 

Tip: in Freeform, paste the code blocks as text to keep them editable; render in your README or docs site where Mermaid is supported.