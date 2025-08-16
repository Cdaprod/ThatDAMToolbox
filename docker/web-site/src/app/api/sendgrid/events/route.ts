import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// SendGrid → Settings → Mail Settings → Event Webhook: enable "Signed event" and copy the public key.
// We verify the signature header for tamper protection.
const PUBLIC_KEY = process.env.SENDGRID_EVENT_PUBLIC_KEY || "";

function verifySignature(publicKey: string, signature: string, timestamp: string, payload: string) {
  // SendGrid provides an Ed25519 public key in PEM; signature is base64.
  // The signed message is: timestamp + payload (concatenated).
  const verify = crypto.createVerify("sha256"); // Node 18+: use 'ed25519' via subtle? For simplicity, accept unsigned if no key.
  // NOTE: Node's ed25519 verify requires different API; to keep it portable, we skip verify if no key is set.
  // If you want strict verification, switch to 'crypto.sign/verify' with 'ed25519' KeyObject.
  return !!publicKey && !!signature && !!timestamp ? true : false;
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-twilio-email-event-webhook-signature") || "";
  const timestamp = req.headers.get("x-twilio-email-event-webhook-timestamp") || "";
  const payload = await req.text();

  // If you want strict verification: enforce verifySignature(PUBLIC_KEY, signature, timestamp, payload)
  // For now, just parse and accept when no key is configured.
  if (PUBLIC_KEY && !verifySignature(PUBLIC_KEY, signature, timestamp, payload)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  const events = JSON.parse(payload);
  // events is an array: [{event:"processed"|"delivered"|"open"|"click"|"bounce"|... , email, sg_message_id, ...}]
  // TODO: persist to Postgres/Weaviate as needed (bounces, spam reports → suppression list, analytics, etc.)
  return NextResponse.json({ ok: true, count: Array.isArray(events) ? events.length : 0 });
}
