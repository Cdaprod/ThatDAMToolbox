# Web Site

Static marketing site built with Next.js.

## Quick Start

```bash
cd docker/web-site
npm run dev
```

Visit http://localhost:3000

## Testing

```bash
npm test
```

# Email (SendGrid) Setup

## What SendGrid requires
1. **API Key**: Create at **Settings → API Keys**. Use a Restricted key with:
   - `Mail Send` (Full Access or at least `Mail Send`)
   - `Event Webhook` verification (if you plan to verify signatures)
2. **Sender Identity** (pick one):
   - **Single Sender Verification**: Quick for testing. Verifies a single from-address.
   - **Domain Authentication**: Production-grade. Add DNS records at your domain DNS.
3. **Dynamic Templates** (optional but recommended):
   - In SendGrid: **Email API → Dynamic Templates**. Create a template (e.g., Welcome, Reset). Use the **Template ID**.
4. **Event Webhook** (optional, recommended):
   - **Settings → Mail Settings → Event Webhook**. Select events: bounce, spamreport, delivered, open, click.
   - Turn on **Signed Events**, copy the **Public Key** to `SENDGRID_EVENT_PUBLIC_KEY`.
   - Point the webhook to: `https://<your-host>/api/sendgrid/events`

## Environment
Populate `.env` or runtime env vars:

```
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
SENDGRID_FROM_NAME=
SENDGRID_REPLY_TO=
SENDGRID_TRACKING_ENABLE=true
SENDGRID_TEMPLATE_WELCOME_ID=
SENDGRID_TEMPLATE_RESET_ID=
SENDGRID_EVENT_PUBLIC_KEY=
```

> **Security**: never commit real keys. Use CI/CD or host secrets.

## Using the API
- **Plain text**:
```bash
curl -X POST https://localhost:3000/api/email/send \
  -H "content-type: application/json" \
  -d '{
    "to": "you@example.com",
    "subject": "Hello",
    "text": "This is a test email from That DAM Toolbox.",
    "tags": ["test","dev"]
  }'
```
- **Dynamic Template**:
```bash
curl -X POST https://localhost:3000/api/email/send \
  -H "content-type: application/json" \
  -d '{
    "to": "you@example.com",
    "templateId": "'$SENDGRID_TEMPLATE_WELCOME_ID'",
    "dynamicData": { "firstName": "David" },
    "tags": ["welcome"]
  }'
```

## Production Notes
- Prefer Domain Authentication so messages come from your domain with good deliverability (SPF/DKIM).
- Keep SENDGRID_API_KEY out of images; supply at runtime.
- Use categories/tags for analytics (billing/reporting).
- Implement the /api/sendgrid/events handler to:
  - move bounces/spam reports to an internal suppression list,
  - log deliveries/opens/clicks for product analytics.

### CI & secrets (quick pointers)
- Put `SENDGRID_API_KEY` et al. in repo/environment secrets (GitHub Actions → Secrets → Actions).
- For local: copy `.env.example` → `.env` and fill values.
- For domain auth: add SPF/DKIM CNAME/TXT records per SendGrid’s instructions (once).

### Why this setup?
- **Server-only**: all email is sent inside API routes (no client exposure of keys).
- **Template-ready**: dynamic templates supported now; you can add more IDs without code changes.
- **Event-aware**: webhook endpoint stub is in place for deliverability + suppression hygiene.
- **Container-native**: env-driven config, no secrets baked into the image.
