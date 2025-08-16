// docker/web-app/src/app/api/schemas/route.ts
import { NextResponse } from 'next/server'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

export async function GET() {
  // adjust the path if your DB lives elsewhere in the container
  const db = await open({
    filename: process.cwd() + '/schemas.db',
    driver: sqlite3.Database,
  })

  const rows = await db.all<{
    topic: string
    service: string
    version: string
    description: string
    schema: string
    updated: string
  }>(`
    SELECT topic, service, version, description, schema, updated
      FROM schemas
      ORDER BY topic
  `)

  await db.close()
  return NextResponse.json(rows)
}