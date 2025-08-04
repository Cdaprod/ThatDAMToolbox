// /docker/web-app/server.js
const http = require('http');
const next = require('next');
const amqp = require('amqplib');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

async function publishServiceUp() {
  try {
    const url = process.env.EVENT_BROKER_URL || 'amqp://video:video@rabbitmq:5672/';
    const conn = await amqp.connect(url);
    const ch = await conn.createChannel();
    const exchange = process.env.BROKER_EXCHANGE || 'events';
    await ch.assertExchange(exchange, 'topic', { durable: true });
    const payload = {
      topic: 'web.service_up',
      ts: Math.floor(Date.now() / 1000),
      payload: { service: 'web-app' }
    };
    ch.publish(exchange, 'web.service_up', Buffer.from(JSON.stringify(payload)));
    await ch.close();
    await conn.close();
    console.log('[event] published web.service_up');
  } catch (err) {
    console.error('[event] publish failed', err);
  }
}

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  server.listen(3000, err => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
    publishServiceUp();
  });
});
