// /web-app/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // For now, just reply with a stub -- you can later call the Python API here if needed
  return NextResponse.json({ status: 'ok', version: '1.0.0', uptime: process.uptime() });
}