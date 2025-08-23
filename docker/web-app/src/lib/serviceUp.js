/**
 * Publish a `service.up` event to RabbitMQ if `amqplib` is available.
 *
 * Broker URL is resolved from `EVENT_BROKER_URL`, `AMQP_URL`, `RABBITMQ_URL`,
 * then defaults to `amqp://video:video@rabbitmq:5672`.
 *
 * Example:
 *   node -e "require('./src/lib/serviceUp').publishServiceUp()"
 */
let amqpMod = null;
function getAmqplib() {
  if (amqpMod) return amqpMod;
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    amqpMod = require('amqplib');
    return amqpMod;
  } catch (e) {
    console.warn('[serviceUp] amqplib not available:', e.message);
    return null;
  }
}

async function publishServiceUp(payload = {}) {
  const amqplib = getAmqplib();
  if (!amqplib) {
    console.warn('[serviceUp] skipping publish; amqplib unavailable');
    return;
  }

  const {
    EVENT_BROKER_URL,
    AMQP_URL,
    RABBITMQ_URL,
    SERVICE_NAME = 'web-app',
  } = process.env;
  const url =
    EVENT_BROKER_URL ||
    AMQP_URL ||
    RABBITMQ_URL ||
    'amqp://video:video@rabbitmq:5672';

  const msg = {
    type: 'service.up',
    service: SERVICE_NAME,
    ts: new Date().toISOString(),
    ...payload,
  };

  let conn;
  try {
    conn = await amqplib.connect(url);
    const ch = await conn.createChannel();
    const ex = 'events';
    await ch.assertExchange(ex, 'topic', { durable: true });
    ch.publish(ex, 'service.up', Buffer.from(JSON.stringify(msg)), { persistent: true });
    await ch.close();
  } catch (err) {
    console.warn('[serviceUp] publish error:', err.message);
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
}

module.exports = { publishServiceUp };
