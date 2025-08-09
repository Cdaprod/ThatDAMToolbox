# Web Site

Static marketing site built with Next.js.

## Quick Start

```bash
cd docker/web-site
npm run dev
```

Visit http://localhost:3000

Set environment variables:

```bash
export SENDGRID_API_KEY=your_key
export SENDGRID_TO_EMAIL=your_email
export NEXT_PUBLIC_LOGIN_URL=https://idp.example.com/login
export NEXT_PUBLIC_PLAUSIBLE_DOMAIN=example.com
```

## Testing

```bash
npm test
```
