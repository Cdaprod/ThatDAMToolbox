# Tenant Settings & Access Control (Prototype Wiring)

- UI Routes
  - `/{tenant}/settings` – General & Branding, Domains, SSO, Storage, Capture Defaults, Permissions + Audit
  - `/{tenant}/access-control` – Members Table, Invite Flow, Role Management, SSO Enforcement Tester, Access Audit
  - `/account` – Profile, Security (MFA), Connected Identities, Default Tenant

- API Routes (App Router)
  - `/api/tenants/[tenant]/settings|domains|sso|storage|capture-defaults|permissions|audit|members|members/[memberId]/roles`
  - `/api/policy/evaluate`
  - `/api/account/profile|security|identities|default-tenant`

- Implementation Notes
  - Uses **in-memory** `src/lib/server/settingsDB.ts` for demo; swap with your DB later.
  - Toasts/messages/empty states match spec verbatim.
  - Minimal coupling to existing code; mounted a Toast boundary in `src/app/layout.tsx`.
