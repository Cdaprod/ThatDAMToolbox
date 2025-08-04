// docker/web-app/src/app/schemas/page.tsx
'use client'

import { useEffect, useState } from 'react'

type SchemaRow = {
  topic: string
  service: string
  version: string
  description: string
  schema: string
  updated: string
}

export default function SchemasPage() {
  const [schemas, setSchemas] = useState<SchemaRow[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/schemas')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json()
      })
      .then(setSchemas)
      .catch((e) => setErr(e.message))
  }, [])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">📡 Event Schemas</h1>
      {err && (
        <p className="text-red-600">
          Failed to load schemas: {err}
        </p>
      )}
      {!err && schemas.length === 0 && (
        <p className="text-gray-500">Loading…</p>
      )}
      <div className="space-y-3">
        {schemas.map((row) => (
          <details
            key={row.topic}
            className="border border-gray-200 rounded-lg p-4 bg-white"
          >
            <summary className="cursor-pointer font-semibold">
              {row.topic} -- {row.service}@{row.version}
            </summary>
            <p className="text-sm text-gray-600 mt-1">
              {row.description}
            </p>
            <pre className="mt-2 overflow-auto bg-gray-50 p-3 rounded">
              {JSON.stringify(JSON.parse(row.schema), null, 2)}
            </pre>
            <p className="text-xs text-gray-400 mt-1">
              Last updated: {new Date(row.updated).toLocaleString()}
            </p>
          </details>
        ))}
      </div>
    </div>
  )
}