# ThatDamToolbox -- GitHub Actions Workflows
#### .github/workflows/README.md

This directory contains all **CI/CD workflow definitions** for building, testing, versioning, and documenting the ThatDamToolbox monorepo.

## **Workflow List**

| Workflow Name                        | Purpose & Triggers                                                      |
|--------------------------------------|-------------------------------------------------------------------------|
| ci-build-and-publish.yml             | Detects changed Docker services, parallel builds, tags & pushes         |
| ci-engineer-env.yml                  | Engineers and validates the full prod-like environment (host+docker)     |
| deploy.yml                           | Build images and deploy via self-hosted runners |
| generate-docker-diagram.yml          | Builds SVG architecture diagrams from docker-compose.yaml                |
| generate-nodeprop-config.yml         | Runs NodeProp config generator & commits results                        |
| ci-audit-and-prune.yml               | Audits workflows and suggests pruning; weekly schedule or manual        |

---

## **Workflow Summaries**

### **ci-build-and-publish.yml**
- **Purpose:**  
  Incrementally builds only changed Docker service images (detected via git), tags using [GitVersion](https://gitversion.net/), and pushes to DockerHub & GHCR. Supports both branch and tag pushes.  
  *Highly parallel, cache-aware, and idempotent.*

- **Key Features:**
  - Service-aware matrix jobs for parallel builds.
  - Auto version tagging (SemVer + short SHA fallback).
  - Build reports and summary artifact uploads.
  - Safe concurrency group prevents duplicate builds.
  - DRY_RUN support (no-push mode for testing).

---

### **ci-engineer-env.yml**
- **Purpose:**  
  Simulates full production environment setup in CI:  
  - Installs system users, directories, and host dependencies.
  - Builds all Go host binaries and all Docker images.
  - Generates and commits the latest architecture diagram.
  - Cleans up after test run.

- **When to Use:**  
  On pushes to `main` and release branches, or for validating environment bring-up logic.

---

### **generate-docker-diagram.yml**
- **Purpose:**  
  Generates a Graphviz `.dot` and `.svg` diagram from `docker-compose.yaml`, visually documenting your container/service/network/volume topology.  
  Commits the SVG to `public/serve/` for embedding in READMEs or docs.

---

### **generate-nodeprop-config.yml**
- **Purpose:**  
  Runs your custom NodeProp configuration/code generator (via [Cdaprod/nodeprop-action](https://github.com/Cdaprod/nodeprop-action)), writes/updates the `.nodeprop.yml` and derived configs, and auto-commits changes.

- **Triggers:**  
  - On push to any branch/tag with `.nodeprop.yaml` or `.nodeprop.yml` changes.
  - Nightly via cron (6am UTC).
  - Manual `workflow_dispatch`.

---

### **ci-audit-and-prune.yml**
- **Purpose:**
  Inventories all workflows, analyzes recent runs, and opens pull requests with suggested path-gates, concurrency blocks, or manualization.
- **Triggers:**
  - Weekly via cron (Mondays 09:00 ET).
  - Manual `workflow_dispatch`.

---

## **General Patterns**

- All workflows are [YAML](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions) and support `workflow_dispatch` for manual CI runs.
- Major artifacts (diagrams, reports, configs) are committed to the repo or uploaded as CI artifacts.
- Host and Docker build/test logic is split, reflecting real hybrid production engineering.

---

## **Adding/Modifying Workflows**

- **Add:**  
  Place a new `.yml` in this directory.
- **Edit:**  
  Update the corresponding workflow file and (optionally) this README.
- **Disable:**  
  Use the `if:` condition or remove triggers.

---

*For CI/CD strategy details, see `.github/README.md`.*
### **deploy.yml**
- **Purpose:**
  Builds multi-arch images and deploys them to self-hosted runners (server and capture roles).
- **Triggers:**
  Pushes to `main`, tags starting with `v` or `release-`, and manual runs via `workflow_dispatch`.
