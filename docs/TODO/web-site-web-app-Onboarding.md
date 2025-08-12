# Agent Brief: ThatDAM Onboarding v1 (Zero-Email Flow)

Intent
- Zero-friction start: users reach dashboard without entering email/password.
- Default SSO + token QR quickstart; anonymous trial workspace; escalate to SSO only for share/invite/recovery/billing.
- Keep web-site as the "marketing + demo sandbox"; web-app is the real product after handoff.

Guardrails (from AGENTS.md)
- Idempotent migrations and endpoints.
- No AWS/Boto3 deps.
- Update docs + tests with PR.
- Keep services self-contained with clear APIs/events.

Feature Flags (env)
- ONBOARDING_ANON_ENABLED=true
- ONBOARDING_QR_ENABLED=true
- AUTH_LOCAL_EMAIL_ENABLED=false
- BOT_GUARD_ENABLED=true

Deliverables (high level)
- web-site: /trial/start sheet (cloud/hybrid), Turnstile/hCaptcha gate, POST /api/trial/start, handoff → app.
- web-app: /handoff exchange endpoint + session cookie; FirstRun coachmark + ConnectSourceSheet (QR/token, NAS/SMB/S3, Upload).
- shared auth-broker: trial workspace + anon session minting, short-lived handoff codes, QR/token pairing service.
- Demo mode: interactive sandbox at web-site /demo using fixtures (no network).

---

## Tasks

1) web-site: Trial Start
- Route: /trial/start (modal/sheet: choose Cloud vs Hybrid; optional Passkey/WebAuthn)
- API: POST /api/trial/start  -> { handoffCode, expiresAt }
- Human gate if BOT_GUARD_ENABLED: Turnstile/hCaptcha; basic rate-limit
- Redirect to app: https://app.thatdam.com/handoff?code=...

2) web-app: Handoff Exchange
- Server endpoint: POST /api/handoff/exchange { code } -> { sessionCookie }
- Bind anon workspace session (httpOnly cookie). TTL 24h; refresh if active.
- Page: /handoff shows spinner → redirects to /app after cookie set.

3) Dashboard First Run
- Banner: "Trial workspace created -- you’re in."
- Coachmark: "Connect your first source"
- Button opens ConnectSourceSheet

4) ConnectSourceSheet (component)
- Tabs:
  a) Camera Proxy → GET /api/pairing/session -> { token, qrSvg, expiresAt }, WS /pairing/:token emits paired
  b) Network Storage (NAS/SMB/S3) → save secret, test connection, enqueue index job
  c) Upload → signed URL or local dev stub
- On success: show live thumbnail or indexed folder; toast "First assets live -- Open Explorer"

5) Auth Escalation (soft gate)
- Wrap actions: Share, Invite, Recovery, Increase limits
- Modal: "Connect an account" buttons (GitHub/Google/Apple/Microsoft) + "Use email (magic link)"
- Magic link only if AUTH_LOCAL_EMAIL_ENABLED=true

6) Demo Sandbox (web-site)
- Route: /demo
- DemoProvider + fixtures; no real network calls
- Tool cards: Explorer (sample tree), Camera Monitor (fake stream), Jobs (progress sim)
- CTA: "Use on my workspace" → /trial/start

7) Shared Auth Broker (service/library)
- POST /trial/start: create workspace + anon identity; issue single-use handoffCode (30–90s)
- POST /handoff/exchange: validate code; mint app session
- POST /pairing/session: return token + QR; WS channel signals pairing
- BOT guard + rate limits; no PII stored until SSO/email added

8) Security & Bots
- Turnstile/hCaptcha on /trial/start, code bound to IP/fingerprint (coarse)
- No bearer tokens in URLs; httpOnly cookies
- Rotate QR/token; show TTL countdown; revoke on close

9) Docs & Telemetry
- docs/ONBOARDING.md: flow, env, API examples, recovery rules
- Track funnel events (view start, handoff success, first source connected, first asset visible)
- Update README: "Try the Explorer (no email) → Create Workspace"

---

## API Stubs (TypeScript-ish)

POST /api/trial/start
- Body: { mode: "cloud" | "hybrid", passkey?: boolean }
- 200: { handoffCode: string, expiresAt: string }

POST /api/handoff/exchange
- Body: { code: string }
- 200: Set-Cookie: session=...; HttpOnly; Secure

POST /api/pairing/session
- Body: { workspaceId: string }
- 200: { token: string, qrSvgDataUrl: string, expiresAt: string }
- WS /api/pairing/:token → { status:"paired", deviceId }

---

## Acceptance (must pass before merge)

- From web-site, I can create a trial and land in web-app dashboard with no email/password.
- ConnectSourceSheet shows QR/token; pairing over WS flips to "paired" within 10s (sim OK in dev).
- Indexing a NAS path or uploading produces visible assets and a toast; Explorer opens them.
- Share/Invite/Recovery triggers SSO modal; email magic link optional.
- Demo sandbox works offline (fixtures only).
- Tests: unit for broker + e2e for handoff/pairing (happy path + expiry).
- Docs updated (ONBOARDING.md) and feature flags listed.

Branch name: feat/onboarding-zero-email