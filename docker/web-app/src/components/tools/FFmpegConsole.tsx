'use client'

import { useState } from 'react'
import { mediaApi } from '../../lib/mediaApi'

/**
 * Simple FFmpeg console ported from legacy Jinja template.
 * Allows entering a command string and displays server output.
 */
export default function FFmpegConsole() {
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)

  async function run() {
    if (!command.trim()) return
    setRunning(true)
    try {
      const res = await mediaApi.ffmpegRun({ command })
      setOutput(res.output)
    } catch (err: any) {
      setOutput(String(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="p-6 space-y-4">
      <h2 className="text-xl font-bold">FFmpeg Console</h2>
      <textarea
        className="w-full border rounded p-2"
        rows={4}
        placeholder="ffmpeg command here"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
      />
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        onClick={run}
        disabled={running}
      >
        {running ? 'Running…' : 'Run'}
      </button>
      {output && (
        <pre className="bg-gray-100 p-2 rounded text-sm whitespace-pre-wrap">{output}</pre>
      )}
    </section>
  )
}
