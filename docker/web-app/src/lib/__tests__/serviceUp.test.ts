import test from 'node:test'
import assert from 'node:assert'
import Module from 'module'
import { publishServiceUp } from '../serviceUp.js'

// Example: node --test src/lib/__tests__/serviceUp.test.ts

test('publishServiceUp skips when amqplib is missing', async () => {
  const originalLoad = (Module as any)._load
  ;(Module as any)._load = (request: string, parent: any, isMain: boolean) => {
    if (request === 'amqplib') {
      throw new Error('missing')
    }
    return originalLoad(request, parent, isMain)
  }

  let warned = 0
  const originalWarn = console.warn
  console.warn = () => { warned++ }

  await publishServiceUp()

  assert.ok(warned > 0)

  console.warn = originalWarn
  ;(Module as any)._load = originalLoad
})

test('publishServiceUp uses EVENT_BROKER_URL', async () => {
  const originalLoad = (Module as any)._load
  let connectUrl = ''
  const fakeConn = {
    createChannel: async () => ({
      assertExchange: async () => {},
      publish: () => {},
      close: async () => {},
    }),
    close: async () => {},
  }
  const fakeAmqp = {
    connect: async (url: string) => {
      connectUrl = url
      return fakeConn
    },
  }
  ;(Module as any)._load = (request: string, parent: any, isMain: boolean) => {
    if (request === 'amqplib') return fakeAmqp
    return originalLoad(request, parent, isMain)
  }

  process.env.EVENT_BROKER_URL = 'amqp://video:video@mq:5672'
  await publishServiceUp()

  assert.strictEqual(connectUrl, 'amqp://video:video@mq:5672')

  delete process.env.EVENT_BROKER_URL
  ;(Module as any)._load = originalLoad
})
