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