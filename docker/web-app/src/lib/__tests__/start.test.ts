import test from 'node:test'
import assert from 'node:assert'
import Module from 'module'
import path from 'node:path'

// Example: node --test src/lib/__tests__/start.test.ts

test('main continues without MQ in dev', async () => {
  const originalLoad = (Module as any)._load
  const fakeServiceUp = {
    publishServiceUp: async () => {},
    requireMq: async () => { throw new Error('unreachable') }
  }
  const fakeSpawn = () => ({
    stdout: { on: () => {} },
    stderr: { on: () => {} },
    on: () => {}
  })
  ;(Module as any)._load = (request: string, parent: any, isMain: boolean) => {
    if (request === './src/lib/serviceUp.js') return fakeServiceUp
    if (request === 'child_process') return { spawn: fakeSpawn }
    return originalLoad(request, parent, isMain)
  }

  let exited = false
  const originalExit = process.exit
  ;(process as any).exit = () => { exited = true }

  const { main } = require(path.join(process.cwd(), 'start.js'))
  await main()

  assert.strictEqual(exited, false)

  process.exit = originalExit
  ;(Module as any)._load = originalLoad
})

test('DEV_SKIP_MQ skips requireMq', async () => {
  const originalLoad = (Module as any)._load
  let called = false
  const fakeServiceUp = {
    publishServiceUp: async () => {},
    requireMq: async () => { called = true }
  }
  const fakeSpawn = () => ({
    stdout: { on: () => {} },
    stderr: { on: () => {} },
    on: () => {}
  })
  ;(Module as any)._load = (request: string, parent: any, isMain: boolean) => {
    if (request === './src/lib/serviceUp.js') return fakeServiceUp
    if (request === 'child_process') return { spawn: fakeSpawn }
    return originalLoad(request, parent, isMain)
  }

  process.env.DEV_SKIP_MQ = '1'
  const { main } = require(path.join(process.cwd(), 'start.js'))
  await main()
  delete process.env.DEV_SKIP_MQ

  assert.strictEqual(called, false)

  ;(Module as any)._load = originalLoad
})
