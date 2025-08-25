/docker/web-app/AGENTS.md

# AGENTS -- Web App (Next.js / TypeScript)

**Scope:** This file defines the roles, responsibilities, prompts, and playbooks for autonomous and semi-autonomous "agents" (human or LLM-assisted) operating **inside `/docker/web-app`** of **ThatDAMToolbox**.  
Use this in tandem with the repo-root `/AGENTS.md` for global policy, and the various `host/.../AGENTS.md` files for service-specific details.

---

## 0) Tech Context & Non-Negotiables

- **Stack:** Next.js (App or Pages router as applicable), TypeScript, MUI, Redux Toolkit, Auth0, Stripe, Axios, WebSockets, RabbitMQ (event bus), Sanity CMS clients, gl-react overlays (focus peaking, zebras, false color), NDI feed viewer(s).
- **Performance:** Prefer dynamic imports for heavy or optional UI, strict code-splitting, image/asset optimization, zero unnecessary client state.
- **Security:** Environment-driven config only; no secrets committed. Respect CORS, SameSite, CSRF, and `NEXTAUTH_URL`/Auth0 flows.
- **Accessibility:** WCAG-AA minimum. Keyboard navigation and focus management are mandatory.
- **DevOps:** GitVersion-driven SemVer; GHCR multi-arch images. Path-gated workflows to avoid wasteful CI runs.
- **Prohibited:** **Do not use AWS or `boto3`.** Favor self-hosted or OSS options.
- **Tone:** This is a product with a brand. Copy and UX should reflect a confident "DevOps + AIOps builder" voice.

---

## 1) Agent Roles (Web-App)

Each role includes: **Mission → Inputs → Outputs → Done Criteria → Guardrails → Canonical Prompts**

### 1.1 UI/UX Implementer
- **Mission:** Translate product/UI specs into responsive, mobile-first components (Camera Monitor, DAM Explorer, Nodes, etc.). Ensure one-page mobile layouts with no scroll when specified.
- **Inputs:** Figma/wireframes, issues, screenshots/video of layout bugs.
- **Outputs:** `.tsx` components, style utilities, MUI theme tokens, `dynamic()` imports, layout fixes.
- **Done Criteria:** No layout overflow on iOS Safari/Chrome; orientation changes don’t zoom or break; controls fit beneath viewport video panel; CLS < 0.1 for target pages.
- **Guardrails:** Keep component boundaries small; no global CSS leaks; use MUI theme + tokens; avoid heavy client libraries in shared layouts.
- **Prompt (LLM helper):**  
  > "Refactor `<Component>` to support portrait mobile without scroll. Keep toolbar below viewport video. Use CSS container queries or MUI breakpoints. Provide only the changed files."

### 1.2 Performance & Bundle Agent
- **Mission:** Reduce TBT/INP, shrink JS, eliminate hydration errors, fix dynamic import warnings.
- **Inputs:** `next build` output, Lighthouse traces, webpack stats, Sentry/LogRocket (if configured).
- **Outputs:** Lazy-loaded modules, SSR/CSR boundary fixes, memoization, `dynamic(() => import(...), { ssr:false })` where needed.
- **Done Criteria:** Bundle size ↓, route-level code-split verified, no "Cannot read properties of undefined (reading 'call')" at runtime.
- **Guardrails:** Do not regress accessibility; validate on mobile Safari; never block the main thread with sync XHR.
- **Prompt:**  
  > "Analyze bundle and propose code-splits for `/dashboard/camera-monitor` and `/dashboard/dam-explorer`. Provide a diff with dynamic imports and notes."

### 1.3 Accessibility Auditor
- **Mission:** Enforce WCAG-AA. Build walkthroughs for keyboard and screen reader flows.
- **Inputs:** Pages and dynamic modals used in onboarding, auth, dashboard tools.
- **Outputs:** ARIA roles/labels, focus trapping, skip-to-content links, contrast fixes.
- **Done Criteria:** Axe scan passes for top routes; keyboard-only flow completes core tasks.
- **Guardrails:** Don’t add ARIA where semantics suffice; avoid div-spans as buttons.
- **Prompt:**  
  > "Audit `/app/(dashboard)/camera-monitor/page.tsx` for WCAG-AA. List issues by severity and provide code suggestions."

### 1.4 Auth & Session Agent (Auth0 / NextAuth)
- **Mission:** Keep sign-in stable (DevSignIn, Google GIS if enabled), ensure tenant routing, protect server components.
- **Inputs:** `getServerSession`, Auth0 configs, middleware, tenant params.
- **Outputs:** Guarded routes, stable redirects, test-able mock providers.
- **Done Criteria:** Returning users land on `/{tenant}/dashboard` reliably; no flicker loops; role claims respected.
- **Guardrails:** Never expose secrets; keep token handling server-side when possible.
- **Prompt:**  
  > "Harden login route: if session exists, redirect to `/{tenant}/dashboard`; otherwise render DevSignIn or GIS button conditionally."

### 1.5 Data Integration Agent (Sanity / GitHub Graph / EventBus)
- **Mission:** Wire data queries/mutations safely with retries and exponential backoff.
- **Inputs:** Sanity client, GraphService APIs, RabbitMQ event topics (read-only in web-app), REST endpoints.
- **Outputs:** Data hooks, loading states, error boundaries, debounced search.
- **Done Criteria:** No blocking UI; cached queries invalidate properly; offline/slow paths degrade gracefully.
- **Guardrails:** Don’t over-fetch; align types with server DTOs; avoid leaking tokens to client.
- **Prompt:**  
  > "Implement suspense-safe data hook for repository graph previews with stale-while-revalidate semantics."

### 1.6 Overlay & Viewer Agent (gl-react / NDI / Video)
- **Mission:** Maintain GPU overlays (focus peaking, zebras, false color) and reliable video preview.
- **Inputs:** `CameraMonitor.tsx`, overlay components, NDI stream endpoints, device orientation signals.
- **Outputs:** Dynamic overlay loader, performance budgeted shaders, device-safe defaults.
- **Done Criteria:** 60fps target on desktop, acceptable on mobile; toggles are latency-free; no WebGL context loss on rotate.
- **Guardrails:** Keep shaders isolated; lazy-load overlays; feature-flag in production.
- **Prompt:**  
  > "Wire overlays via dynamic import with per-overlay toggles and memoized props. Ensure no extra JS when overlays disabled."

### 1.7 Test & QA Agent
- **Mission:** E2E user-flow tests for auth → dashboard → monitor/record → browse assets.
- **Inputs:** Playwright/Vitest config.
- **Outputs:** Smoke tests + critical path tests, mobile viewport specs, CI-friendly artifacts.
- **Done Criteria:** Green tests for main flows; screenshots/videos for failures.
- **Guardrails:** Avoid flaky time-dependent waits; use role/label selectors.
- **Prompt:**  
  > "Add an E2E spec that logs in (dev provider), opens Camera Monitor, toggles a GPU overlay, verifies canvas present."

### 1.8 Release & CI Agent
- **Mission:** Keep workflows lean, path-gated, and artifact-rich.
- **Inputs:** `.github/workflows/*`, Makefile, GitVersion.
- **Outputs:** Path filters for `/docker/web-app/**`, multi-arch builds (AMD64/ARM64) pushed on tag, PR previews if configured.
- **Done Criteria:** Only web-app changes build the web-app; tags push images; branch rules respected.
- **Guardrails:** No secrets in logs; cache Buildx; avoid redundant jobs.
- **Prompt:**  
  > "Propose path-gating for web-app workflows and a release matrix for `linux/amd64, linux/arm64`."

---

## 2) BabyAGI Methodology (Applied Here)

### 2.1 TaskCreationChain
Break work into atomic tasks:
1. Clarify route/scope (e.g., `/dashboard/camera-monitor`).
2. Identify performance and A11y constraints.
3. Define data dependencies and states.
4. Plan code-split points and dynamic imports.
5. Draft tests (E2E + unit where valuable).
6. Prepare CI path-gates and caching hints.
7. Write/commit minimal, incremental diffs.

### 2.2 TaskPrioritizationChain
Order by **user-facing risk** → **perf impact** → **security/auth** → **developer velocity**:
1. Fix runtime errors/hydration issues blocking use.
2. Stabilize mobile-first layout & orientation.
3. Reduce JS/CPU cost; move work off main thread where possible.
4. Secure auth and tenant routing.
5. Hook real data w/ graceful loading, then add polish (overlays, animations).
6. Add tests for new flows; wire CI gates.

### 2.3 ExecutionChain
- Implement -> run `docker compose` dev -> mobile Safari/Chrome test -> Lighthouse check -> axe scan -> Playwright run -> commit minimal diffs with clear scope.

---

## 3) Runbooks

### 3.1 Local Dev (Dockerized)
- Rebuild & up:
  - `dcd -v && dcu --build -d`  
  - If cache issues: `docker buildx prune -f` (be cautious), then rebuild.
- View logs: `docker compose logs -f web-app`
- Open on mobile: use LAN IP + exposed port; confirm HMR reconnects.

### 3.2 Debugging Common Issues
- **Unhandled Runtime Error / webpack "reading 'call'"**  
  - Check dynamic import paths and SSR/CSR boundaries.  
  - Validate that `dynamic(..., { ssr:false })` is set for browser-only modules.  
  - Ensure no server component imports client-only modules.

- **DevTools Message on Mobile**  
  - For embedded React DevTools server: start via node launcher only in dev; keep off in prod.  
  - Provide a UI toggle guarded by `process.env.NODE_ENV === 'development'`.

- **Orientation / Zoomed UI on iOS**  
  - Lock scale via meta viewport; ensure container queries; avoid 100vh traps; test Safari "Add to Home Screen" PWA mode.

### 3.3 Accessibility Pass
- Keyboard tab order makes sense across toolbar → viewer → overlays → dialogs.  
- Focus trap inside modals.  
- Labels and roles for buttons/toggles; visible focus outline.

---

## 4) CI/CD Guardrails (Web-App Path-Gating)

**Only build/deploy web-app when these paths change:**

docker/web-app/**
!docker/web-app/public/demo/**

**Typical jobs:**
- Lint & typecheck (TS, ESLint)
- `next build` (analyze bundles)
- Playwright E2E (headless, mobile viewport)
- Buildx matrix (`linux/amd64`, `linux/arm64`) → push to GHCR on tag
- Upload build artifacts (standalone `.next/standalone` if used)

**Versioning:** GitVersion determines `X.Y.Z` from branches/tags; tags trigger publish.

---

## 5) Environment & Configuration

- Config comes from **env only** (and `.env.local` for dev), e.g.:
  - `NEXT_PUBLIC_API_BASE`
  - `NEXT_PUBLIC_WEBSOCKET_URL`
  - `NEXT_PUBLIC_SANITY_PROJECT_ID`
  - `AUTH0_*` / `NEXTAUTH_URL`
  - `STRIPE_PUBLISHABLE_KEY`
- **Never** hardcode secrets. Respect tenant routing (`/{tenant}/...`) where required.
- Prefer feature flags for overlays/experiments: `NEXT_PUBLIC_FEATURE_OVERLAYS=true`

---

## 6) File Conventions (Web-App)

- **Components:** `src/components/<Domain>/<Name>.tsx` (small, focused)  
- **Pages/Routes:** organized under `src/app/...`  
- **Hooks:** `src/hooks/useThing.ts` (no side effects on import)  
- **State:** Redux slices under `src/store`, selectors colocated  
- **Styles:** MUI theme + tokens; avoid global CSS leaks  
- **Overlays:** `src/components/overlays/*` (each overlay isolated, dynamically imported)

---

## 7) Definition of Done (Per PR touching Web-App)

- [ ] Mobile portrait layout verified (no scroll when specified)  
- [ ] Hydration errors resolved; server/client boundaries correct  
- [ ] Bundle diff shows net-neutral or reduced size for non-overlay paths  
- [ ] Axe scan has no criticals; keyboard flow works  
- [ ] New/changed flows covered by Playwright  
- [ ] Env usage documented in PR notes  
- [ ] CI path-gates respected; jobs green

---

## 8) Agent Comms & Handoffs

- **Issue template:** include "Route(s) touched," "Loading states," "A11y notes," "Perf budget."  
- **PRs:** small, focused; include before/after screenshots or short clips (mobile).  
- **Handoff checklist:** routes, envs, flags, testing notes, rollout steps.

---

## 9) Example Agent Requests (Copy-Paste Prompts)

- **Layout Fix:**  
  "Make Camera Monitor one-screen in portrait mobile: video viewport on top, controls below. Prevent zoom on rotate. Provide changed files only."

- **Perf Split:**  
  "Code-split overlays so baseline viewer ships minimal JS; load overlays on toggle. Confirm no hydration mismatch."

- **A11y Pass:**  
  "Add ARIA labels to toolbar buttons and ensure focus order starts at skip-to-content, then primary actions."

- **Data Hook:**  
  "Create a SWR-style hook for Sanity repository cards with skeletons and error boundaries; SSR where possible."

- **Test:**  
  "Add Playwright spec to verify login → open monitor → enable zebra overlay → assert canvas exists and FPS indicator appears."

---

## 10) Glossary (Web-App)

- **Overlay:** GPU-accelerated visual layer rendered over live video (e.g., focus peaking).  
- **Viewer:** The video element/canvas/GL surface receiving NDI/stream content.  
- **Tenant:** Path-scoped namespace segment used in routing (`/{tenant}/dashboard`).  
- **Path-Gating:** CI strategy to run jobs only if specific paths changed.

---

_This file evolves with the code. If an agent’s work introduces new conventions (e.g., another overlay type, a new data source), add the role notes and update DoD accordingly._