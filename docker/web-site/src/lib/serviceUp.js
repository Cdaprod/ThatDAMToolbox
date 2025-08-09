// docker/web-site/src/lib/serviceUp.js
// Example: node src/lib/serviceUp.js
const amqplib = require('amqplib')

async function publishServiceUp() {
  const url = process.env.EVENT_BROKER_URL || process.env.AMQP_URL || 'amqp://guest:guest@localhost:5672/'
  const exchange = process.env.BROKER_EXCHANGE || 'events'
  const routingKey = 'website.service_up'

  try {
    const conn = await amqplib.connect(url)
    const channel = await conn.createChannel()
    await channel.assertExchange(exchange, 'topic', { durable: true })

    const message = {
      topic: routingKey,
      ts: Math.floor(Date.now() / 1000),
      payload: { service: 'web-site' }
    }

    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)))
    await channel.close()
    await conn.close()
    console.log(`[event] published ${routingKey}`)
  } catch (err) {
    console.error('[event] publish failed', err)
  }
}

if (require.main === module) {
  publishServiceUp()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

module.exports = { publishServiceUp }
