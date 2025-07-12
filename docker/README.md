# David’s Video-Service Architecture (docker/README.md)

Everything you need to build, test, and run the platform’s containers lives under **`/docker/`**.  
Each first-level directory is a *build context* for one runtime service, plus a shared **`base/`** image to keep dependencies consistent.

```
/docker/
├── base/                 # Common Python + FFmpeg image
├── video/                # CLI / batch processor
├── video-api/            # FastAPI (REST / GraphQL) façade
├── web/                  # Nginx-served Jinja + JS frontend
├── dam/                  # Headless DAM API (optional)
├── modules/              # Extra micro-services (only if truly independent)
├── compose/              # Compose files for each environment
├── scripts/              # Helper scripts (build, dev-up, prod-up, …)
└── README.md             # ← this file
```

-----

## Architecture Flow

```mermaid
flowchart LR
    U[UI / UX<br/>Sanity • Web UI • Dashboards]
    P[API Gateway / Proxy<br/>nginx • Auth]
    C[Core APIs / Services<br/>video-api • video]
    S[Storage / Workers<br/>MinIO • Redis • Weaviate • Postgres • Celery]
    O[Observability / CI<br/>Grafana • Prometheus • notebook • tests]

    U --> P
    P --> C
    C --> S
    S --> O
```

-----

## 1. Why the folder-per-service pattern?

- **Isolation** – each Docker build context contains only the code it needs, so layer caching stays tight and builds stay fast.
- **Parallel CI** – GitHub Actions can fan out a matrix job (`service=video,video-api,…`) and build every image at once.
- **Selective releases** – the workflow tags and pushes only the images whose folders changed.
- **Clear boundaries** – the directory tree mirrors the runtime architecture, making it obvious where to tweak a service.

-----

## 2. How the pieces fit together

|Layer                   |Runtime examples                                   |
|------------------------|---------------------------------------------------|
|**UI / UX**             |Sanity Studio, dashboards, static site             |
|**API Gateway / Proxy** |Nginx TLS termination, auth middleware             |
|**Core APIs / Services**|`video-api` (FastAPI), `video` (batch/CLI)         |
|**Storage / Workers**   |MinIO, Redis, Weaviate, Postgres, Celery           |
|**Observability / CI**  |Grafana, Prometheus, Jupyter notebook, test runners|

The Mermaid diagram at the top shows the request path flowing *down* the stack and telemetry flowing *up*.

-----

## 3. Service rationale

- **`video/`** – wraps `bootstrap.py`, `cli.py`, and batch commands; the one-shot worker for video enrichment and transforms.
- **`video-api/`** – stateless HTTP interface that calls into `video` logic; scales independently behind the proxy.
- **`web/`** – thin Nginx container that serves `web/templates` + `web/static`; keeps the Python API lean.
- **`dam/`** – only split out if the DAM subsystem must be deployed (or scaled) on its own; otherwise → fold into `video-api`.
- **`modules/`** – place long-running extras like `hwcapture` only if they truly need their own container; otherwise expose them as CLI sub-commands.

-----

## 4. Compose files

|File                            |Purpose                                                      |
|--------------------------------|-------------------------------------------------------------|
|**`compose/docker-compose.yml`**|baseline stack: `video`, `video-api`, core backing stores    |
|**`docker-compose.dev.yml`**    |local-dev overrides (source mounts, auto-reload, debug ports)|
|**`docker-compose.prod.yml`**   |production overrides (no volumes, stricter health checks)    |
|**`docker-compose.modules.yml`**|optional extras for `modules/` containers                    |

Run-up patterns:

```bash
# Local hacker mode
docker compose \
  -f docker/compose/docker-compose.yml \
  -f docker/compose/docker-compose.dev.yml \
  up --build

# Clean production
docker compose -f docker/compose/docker-compose.yml -f docker/compose/docker-compose.prod.yml up -d
```

-----

## 5. Base image workflow

1. `/docker/base/Dockerfile` installs Python 3.12, FFmpeg, and any OS libraries once.
1. Down-stream Dockerfiles start with `FROM thatdamtoolbox_base:latest`, copy only their service code, then `pip install -r requirements.txt`.
1. CI publishes base first; service builds then reuse the cached layers automatically.

-----

## 6. CI / CD highlights

- **Change detection** – the Action watches `docker/*/**`; untouched services do not rebuild.
- **Matrix parallelism** – one runner per changed service; cancel-in-progress avoids double builds.
- **Lower-case images** – the workflow converts `$IMAGE_PREFIX` and `$service` to lower-case so container registries stay happy, even if your GitHub org is ThatCapsOrg.
- **Prefixing** – image names follow `docker.io/<user>/<repo>-<service>:<tag>`. Copy the same workflow to a new repository and the prefix updates automatically.

-----

## 7. Local development tips

- **Mount the repo root** into your container (`volumes: - ../../:/app`) and add `--reload` to the API command for instant feedback.
- **Keep dotenv files** (`.env`, `.env.local`) inside `docker/compose/` so they’re easy to share but stay out of the image build context.
- **Use BuildKit’s inline cache** ⇢ `docker buildx build --cache-to type=inline` ⇢ lightning-fast rebuilds when iterating on one service.

-----

**Happy shipping!**

Questions or improvements? Open an issue or ping @Cdaprod on GitHub.