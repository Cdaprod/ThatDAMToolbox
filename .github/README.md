# ThatDamToolbox -- GitHub CI/CD & Automation Directory
#### .github/README.md

This `.github` directory contains all meta-repo automation for **CI/CD, environment engineering, build pipelines, versioning, and documentation generation**.  
Every major CI job is defined here using [GitHub Actions](https://docs.github.com/en/actions), enabling robust, idempotent, and reproducible automation for both Dockerized and bare-metal Go host services.

## **Directory Overview**

```text
.github/
├── GitVersion.yml         # Semantic versioning and release rules (via GitVersion)
├── README.md              # (This file)
└── workflows/             # All GitHub Actions workflows
├── ci-build-and-publish.yml
├── ci-engineer-env.yml
├── generate-docker-diagram.yml
├── generate-nodeprop-config.yml
└── README.md
``` 

- **GitVersion.yml** -- [GitVersion](https://gitversion.net/) config: controls semantic versioning, release, and tagging policy for Docker images and monorepo versioning.
- **workflows/** -- Each `.yml` file is a GitHub Actions workflow automating builds, deployments, codegen, or diagram generation.

---

## **Workflows At-a-Glance**

- **ci-build-and-publish.yml**  
  Detects service changes and builds/pushes *only* changed Docker images in parallel, auto-tagged using GitVersion, supporting DockerHub and GHCR.

- **ci-engineer-env.yml**  
  Fully engineers and simulates the host environment: builds all Go binaries, configures system users/dirs, builds all Docker images, and generates an up-to-date repo architecture diagram--mirroring production bring-up.

- **generate-docker-diagram.yml**  
  Generates a [Graphviz](https://graphviz.gitlab.io/) SVG diagram from your `docker-compose.yaml`, visually documenting container/service topology.

- **generate-nodeprop-config.yml**  
  Runs a custom NodeProp config/code generator, commits any changes to config artifacts, and ensures the latest environment YAMLs are always present.

- **README.md**  
  *This file*: Explains directory purpose and workflow patterns.

---

## **Conventions**

- **DRY_RUN** and safe push: All workflows can be run in "dry run" (no push/tag) or live mode.
- **Architecture Diagrams**: All diagram outputs are placed in `public/serve/` for easy publishing.
- **Automated versioning:** Uses `GitVersion.yml` rules for semantic versioning; tags are applied automatically.

---

## **Extending CI/CD**

To add a new workflow, place a `.yml` file under `.github/workflows/`.  
To add new versioning rules, update `.github/GitVersion.yml`.  
All codegen and doc artifacts (e.g., architecture SVGs, NodeProp configs) are committed by bot steps when changed.

---

## **Troubleshooting**

- CI log output is visible in the Actions tab.
- To debug service builds, check the artifact build reports and SVG diagrams.
- Manual runs: All workflows support `workflow_dispatch` for ad hoc execution.

---

*For workflow-specific docs, see `.github/workflows/README.md`.*

---
---

# Graveyard

# Complete Monorepo CI/CD Workflow

Below is a pattern many monorepos use to make Docker builds parallel, idempotent, and name-safe.
It keeps the same two-job layout you already have (change-detector → build) but replaces loops with a dynamic strategy matrix, adds safe concurrency controls, and prefixes every image with the repository slug so multiple repos can reuse the same workflow without collisions.

-----

## 1. Change detector (still fast, but action-driven)

```yaml
# .github/workflows/ci-build-and-publish.yml
name: CI-Build-and-Publish

on:
  push:
    branches: ["**"]
    tags: ["**"]
    paths:
      - "docker/*/**"        # was services/*
      - ".github/workflows/ci-build-and-publish.yml"
      - ".github/GitVersion.yml"

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.filter.outputs.json }}   # << JSON list of changed dirs
    steps:
      - uses: actions/checkout@v4
        with: {fetch-depth: 0}

      # 🎯 Drop the hand-rolled git diff and use a proven helper
      - id: filter
        uses: tj-actions/changed-files@v39        # or dorny/paths-filter
        with:
          dir_names: "true"
          dir_names_max_depth: "1"
          json: "true"
          files: |
            docker/**/*
```

The `changed-files` action spits out a JSON array like `["video","video-api"]`; we forward that to the next job.

-----

## 2. Parallel build & push job

```yaml
  build-and-push:
    needs: detect-changes
    if: ${{ needs.detect-changes.outputs.matrix != '[]' }}
    runs-on: ubuntu-latest

    # 🔹 One job-instance per service  ➜ perfect parallelism
    strategy:
      fail-fast: false
      matrix:
        service: ${{ fromJson(needs.detect-changes.outputs.matrix) }}

    # 🔒 Idempotence: only one build per service per branch; cancel superseded
    concurrency:
      group: build-${{ matrix.service }}-${{ github.ref }}
      cancel-in-progress: true      # stops duplicate runs on force-pushes

    permissions:
      contents: write
      packages: write

    env:
      REGISTRY_USER:  cdaprod
      REGISTRY_TOKEN: ${{ secrets.DOCKERHUB_TOKEN }}
      IMAGE_PREFIX:   ${{ github.event.repository.name }}  # <repo>-<service>

    steps:
      - uses: actions/checkout@v4
        with: {fetch-depth: 0, fetch-tags: true}

      - uses: gittools/actions/gitversion/setup@v0.10.2
        with: {versionSpec: '5.x'}

      - id: gitversion
        uses: gittools/actions/gitversion/execute@v0.10.2

      - uses: docker/setup-buildx-action@v3     # latest Buildx

      - uses: docker/login-action@v2
        with:
          username: ${{ env.REGISTRY_USER }}
          password: ${{ env.REGISTRY_TOKEN }}

      # 🏷 automatic tag & label generator (sha, SemVer, latest …)
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: |
            docker.io/${{ env.REGISTRY_USER }}/${{ env.IMAGE_PREFIX }}-${{ matrix.service }}
            ghcr.io/${{ env.REGISTRY_USER }}/${{ env.IMAGE_PREFIX }}-${{ matrix.service }}
          tags: |
            type=raw,value=${{ steps.gitversion.outputs.SemVer }}
            type=sha,format=short
            type=raw,value=latest

      # 🚀 build + push (cache-aware, multi-arch)
      - uses: docker/build-push-action@v5
        with:
          context: ./docker/${{ matrix.service }}
          file: ./docker/${{ matrix.service }}/Dockerfile
          platforms: linux/amd64,linux/arm64
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          push: true        # automatically skipped on PRs from forks if no token
          cache-from: type=registry,ref=${{ steps.meta.outputs.images }}:buildcache
          cache-to:   type=registry,ref=${{ steps.meta.outputs.images }}:buildcache,mode=max
```

## What changed vs. your loop?

|Old loop                      |New matrix job                                   |
|------------------------------|-------------------------------------------------|
|Serial build inside one runner|Parallel runners, one per service                |
|Manual tag collision check    |docker/metadata-action auto-generates unique tags|
|Hard-coded services/ path     |Uses docker/${{ matrix.service }} path           |
|No cancel-in-progress         |Concurrency group prevents duplicated builds     |
|No build cache                |Buildx cache-from/to makes reruns incremental    |

-----

## 3. Why this is "more idempotent"

1. **Deterministic inputs** – each job sees exactly one service dir; the hash of its context defines the image digest.
1. **Single active builder per service/branch** via concurrency.group.
1. **BuildKit cache line** keeps layer reuse across runs and across branches.
1. **Metadata-action guarantees** the same Git ref always maps to the same tag set.

-----

## 4. Portable image-prefixing

Because the build job concatenates:

```
${{ env.IMAGE_PREFIX }}-${{ matrix.service }}
```

you can drop this same workflow into any repo and get:

```
docker.io/cdaprod/thatdamtoolbox-video:1.2.3
docker.io/cdaprod/thatdamtoolbox-video-api:1.2.3
```

If you need a custom prefix, just set a repo-level secret or variable `IMAGE_PREFIX=toolbox` and the expression above will use it instead.

-----

## 5. Bonus tips

- **Fail-fast false** ensures one bad service doesn’t cancel the others.
- **needs: only on detect-changes** keeps the graph shallow; you can add a third job for integration tests that depends on all builds (needs: build-and-push).
- **Add pull_request:** to on: so forks get CI without granting registry creds.

With these tweaks you get maximum parallelism, deterministic output, and safe namespace-wide image names--ready to duplicate across every repo in your monorepo family.

-----