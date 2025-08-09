# Web Site

Static marketing site built with Next.js.

## Quick Start

```bash
cd docker/web-site
npm install
npm run dev
```

Visit http://localhost:3000

To enable the contact form, set these variables:

```
export SENDGRID_API_KEY=your_key
export SENDGRID_TO_EMAIL=your_email
```

## Testing

```bash
node --test src/lib/sendMail.test.js
```
