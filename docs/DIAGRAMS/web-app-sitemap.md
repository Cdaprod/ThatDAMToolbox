```mermaid
flowchart TD
  subgraph Global Shell [/App Shell/]
    A[TopBar: Org/Tenant • Profile • Search • Alerts • Help]
    B[LeftNav: Dashboard • Nodes • Plans • Agents • Capture • Assets • Jobs • Events • Settings]
    C[RightPanel: Inspector/Logs/Events]
  end

  A --> D[Dashboard]
  B --> E[Nodes]
  B --> F[Plans]
  B --> G[Agents]
  B --> H[Capture]
  B --> I[Assets]
  B --> J[Jobs]
  B --> K[Events]
  B --> L[Settings]

  subgraph Dashboard
    D1[Env Summary]:::panel -->|/v1/leader| D
    D2[Health & Heartbeats]:::panel -->|/v1/nodes/heartbeat + broker overlay.*| D
    D3[Top Alerts]:::panel -->|events| D
    D4[Quick Actions]:::panel -->|issue token • deploy agent| D
  end

  subgraph Nodes
    E1[Node List] -->|GET /v1/nodes/plan| E
    E2[Node Detail] -->|GET /v1/nodes/register| E
    E3[Services per Node] -->|services[] in plan| E
  end

  subgraph Plans
    F1[Profiles] -->|GET /v1/bootstrap/profile| F
    F2[Edit Profile] -->|PUT /v1/bootstrap/profile| F
    F3[Apply/Recon] -->|POST /v1/bootstrap/profile| F
  end

  subgraph Agents
    G1[Issue/Rotate Tokens] -->|POST /agents/issue (api-gateway)| G
    G2[Overlay Registry] -->|/v1/register /v1/heartbeat (overlay-hub)| G
  end

  subgraph Capture
    H1[Devices] -->|capture-daemon /devices| H
    H2[Live Preview] -->|HLS/WebRTC| H
    H3[Record Controls] -->|POST /record| H
  end

  subgraph Assets
    I1[Browse DAM] -->|video-api /search| I
    I2[File Detail] -->|/metadata /thumb| I
    I3[Semantic Search] -->|Weaviate (optional)| I
  end

  subgraph Jobs
    J1[Ingest Jobs] -->|video-api /scan| J
    J2[Analysis Jobs] -->|/motion/extract| J
  end

  subgraph Events
    K1[Live Console] -->|RabbitMQ overlay.* capture.* video.* webapp.*| K
    K2[Filters & Saved Views] -->|client-side| K
  end

  subgraph Settings
    L1[Org & Tenants] -->|Auth0/claims view| L
    L2[RBAC Roles] -->|JWT claims| L
    L3[Integrations] -->|webhooks, presign, weaviate toggle| L
  end

  classDef panel fill:#f6f6ff,stroke:#8a8aff,stroke-width:1px;
``` 
