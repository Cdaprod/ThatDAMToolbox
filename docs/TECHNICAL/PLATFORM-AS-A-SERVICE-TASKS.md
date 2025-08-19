I’d say let’s build each service independently but wired together and complete lists of task for: frontend as well as for website, as well as for backend and IdP + JWT claims.

Here’s a structured set of task lists to help you build out each part of your platform--website, frontend app, backend services, and identity provider (IdP) with JWT claims--as production‑ready, loosely coupled components that still work seamlessly together.

1. Website (Marketing / Public Site)

Planning & Design
	•	Define the purpose and scope: home page, product details, pricing, documentation, blog, contact/support.
	•	Sketch wireframes and a style guide consistent with the app’s branding.
	•	Decide on technology: static-site generator (Next.js static pages, Hugo, or Astro) vs. a headless CMS (Strapi, Contentful).

Development Tasks
	•	Implement static pages: Home, "How it works," Pricing, About, Contact, Blog/Docs.
	•	Deploy a blog/docs generator (e.g., MDX in Next.js or Markdown files in Hugo) with syntax highlighting and search.
	•	Add contact/support forms with spam protection (CAPTCHA), backed by email (SendGrid) or ticketing.
	•	Embed marketing analytics (Google Analytics, Plausible) and cookie consent banner.
	•	Integrate call‑to‑action buttons for signing up/logging into the app; point them to the IdP login endpoint.

Infrastructure Tasks
	•	Provision a separate domain or subdomain (e.g., www.example.com) with TLS certificates.
	•	Put the site behind a CDN for caching and faster global delivery.
	•	Set up CI/CD to automatically build and deploy on merge (e.g. to Vercel/Netlify or S3+CloudFront).
	•	Configure proper HTTP headers (HSTS, CSP) and SEO metadata.

Maintenance
	•	Establish a content update workflow (e.g., via CMS or Git commits).
	•	Add uptime and error monitoring (StatusPage, Pingdom).

⸻

2. Frontend App (Authenticated UI)

Architecture & Foundations
	•	Decide on framework (Next.js for SSR/CSR with React) and TypeScript for type safety.
	•	Set up a component library/theme (e.g., Tailwind, Chakra, MUI) consistent with the website.
	•	Define the page structure: dashboard, device list, livestream, recordings, organization settings, user settings.

Authentication & Session
	•	Integrate with the IdP using OIDC: implement login, callback handling, token storage (httpOnly cookies preferred), refresh handling.
	•	Protect routes via higher-order components or middleware that check for valid JWTs/roles.
	•	Implement logout that clears tokens and calls the IdP’s logout endpoint.

Core Features
	•	Device & stream management: display camera list from camera-proxy, show statuses, allow start/stop streaming.
	•	Recording management: list, search, and playback recordings; request deletion or download.
	•	Organization & user settings: allow owners to invite/manage members, view current plan, billing info, usage stats.
	•	Notifications & real‑time updates: integrate WebSocket endpoints (via api-gateway) for status changes.
	•	Error handling & loading states: global error boundary and skeleton loaders.

Infrastructure & DevOps
	•	Separate dev/prod configuration via .env.local and runtime environment variables (NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_WS_URL, etc.).
	•	Build production artifacts (next build && next export) and push to a hosting platform or containerize.
	•	Use monitoring (Sentry) and feature flags (LaunchDarkly or homegrown) for controlled rollouts.

Security & Compliance
	•	Enforce HTTPS, set CSP, X-Frame-Options, etc.
	•	Validate all input; guard against XSS/CSRF (httpOnly cookies, SameSite settings).
	•	Internationalize where needed (i18n library).

⸻

3. Backend Services (Golang & Python Microservices)

You already have a mesh of services (api-gateway, camera-proxy, capture-daemon, overlay-hub, Python video-api). Bring them to production grade:

Common Infrastructure
	•	Standardize base images (e.g., golang:1.22-alpine, python:3.11-slim) and multi‑arch builds for ARM/x86.
	•	Use a shared damnet network in Compose or Kubernetes; externalize configuration via .env and secrets.
	•	Add proper healthchecks (liveness/readiness) and graceful shutdown hooks.
	•	Implement logging with structured JSON and propagate request IDs across services.

api-gateway (Go)
	•	Harden JWT verification: load the IdP JWKS; reject expired tokens; validate aud, iss, org_id, roles.
	•	Implement rate limiting, caching, and security headers.
	•	Expose versioned endpoints (/v1/…) and auto‑generate OpenAPI docs.
	•	Proxy to underlying services based on path (/api/devices → camera-proxy, /api/video → video-api).
	•	Instrument with Prometheus metrics.

camera-proxy (Go)
	•	Finalize device discovery with error surfacing; expose only selected device capabilities per role.
	•	Add environment‑driven origin restrictions for WebSocket upgrades.
	•	Handle streaming backpressure and FFmpeg process restarts gracefully.
	•	Cache and reconcile device list with capture-daemon.

capture-daemon (Go)
	•	Move from "all devices" to multi‑tenant scheduling: persist per‑tenant devices, recordings, state.
	•	Respect concurrency limits; implement queueing/priority.
	•	Provide status endpoints for each recording session and streaming session.
	•	Implement retention/cleanup policies.

overlay-hub (Go)
	•	Harden registration and heartbeat: authenticate clients with JWT or API key.
	•	Provide failover or clustering (active/passive or via a small DHT).

video-api (Python/FastAPI)
	•	Ensure all route handlers authorize based on JWT claims (org_id, roles).
	•	Expose CRON or Celery for background processing (e.g., clip generation, analytics extraction).
	•	Hook into Weaviate/PGVector or other vector DB for search; abstract via repository pattern.
	•	Introduce GraphQL or gRPC if richer queries are needed.

Additional Services (Infra)
	•	Add Weaviate/Postgres for vector search; MinIO for S3 storage (as outlined earlier) and wire them via environment.
	•	Move rabbitmq into a managed cluster or a cloud bus (NATS/MQTT) if scaling.
	•	Optional: service mesh (Istio/Linkerd) if you adopt Kubernetes.

⸻

4. Identity Provider & JWT Claims

Selecting & Setting Up IdP
	•	Choose a provider (Auth0, AWS Cognito, Okta, Keycloak, ORY Hydra). Host it yourself or use SaaS.
	•	Create an "Application"/"Client" for your app: configure callback URL (https://app.example.com/callback), allowed logout URLs, and assign scopes.
	•	Set up multi-tenancy if using Keycloak: realm per environment or tenant.
	•	Configure email/SMS for MFA and password reset.

Define User & Organization Model
	•	Decide on hierarchy: Organization → User with roles (owner, admin, viewer).
	•	For billing: include plan and subscription_status in user metadata or separate billing service.
	•	Provide invitation flows (IdP or your own email invites) and track pending invitations.

Design JWT Claims
	•	Standard claims: iss, aud, sub, exp, iat.
	•	Custom claims in a namespace (e.g., https://example.com/org_id, https://example.com/roles):
	•	org_id: tenant/organization GUID.
	•	user_id: internal user GUID.
	•	roles: list of roles in that org (owner, admin, etc.).
	•	plan: tier (free, pro, enterprise).
	•	features: enabled feature flags for this user/org.
	•	Decide token lifetime and refresh policy; implement rotating refresh tokens.

Integrate Auth Flows
	•	Frontend: use the IdP’s SDK (Auth0 React SDK, AWS Amplify, etc.) or openid-client for manual OIDC; store access+refresh tokens in httpOnly cookies; trigger silent refresh before expiration.
	•	api-gateway: fetch JWKS on startup; cache and rotate keys; verify signature and parse claims; reject invalid scopes/roles.
	•	Downstream services: optionally verify tokens themselves or trust the gateway to forward verified context via headers (X-User-ID, X-Org-ID, X-Roles).
	•	Implement logout by redirecting to IdP’s logout endpoint and clearing cookies.

Account Management & Security
	•	Provide a self‑service user portal for password reset, profile updates, MFA enrollment.
	•	Implement SCIM or APIs for external provisioning if you plan to sell to larger enterprises.
	•	Set up automated monitoring for suspicious login attempts and brute force detection.
	•	Ensure compliance with GDPR/CCPA: data deletion, consent mechanisms.

⸻

Putting It All Together
	•	Treat each layer (website, frontend app, backend, IdP) as independently deployable; version them separately.
	•	Use a single source of truth for configuration (e.g., Kubernetes ConfigMaps/Secrets or .env files in Docker) and secret management.
	•	Standardize on CI/CD pipelines per service; enforce linting, tests, vulnerability scans.
	•	Use infrastructure-as-code to provision clusters, buckets, databases, IdP realms, etc.
	•	Document your architecture and API contracts; generate diagrams and OpenAPI specs; keep them versioned.

This separation will let you evolve or swap out parts (like switching from Weaviate to pgvector) without rewriting everything, while still giving your users a seamless, unified experience.