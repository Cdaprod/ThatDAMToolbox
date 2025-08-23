/**
 * Publish a `service.up` event to RabbitMQ (best-effort in dev).
 *
 * URL resolution precedence:
 *   EVENT_BROKER_URL > AMQP_URL > RABBITMQ_URL > `amqp://video:video@rabbitmq:5672`
 *
 * Dev ergonomics:
 *   - Set DEV_SKIP_MQ=1 to skip MQ entirely during UI work.
 *   - ECONNREFUSED is downgraded to a log note in dev.
 */

let amqp = null; // lazy-loaded module
let _conn = null;
let _chan = null;
let _connecting = null;

const isProd = process.env.NODE_ENV === 'production';

function getUrl() {
  const {
    EVENT_BROKER_URL,
    AMQP_URL,
    RABBITMQ_URL,
  } = process.env;
  return EVENT_BROKER_URL || AMQP_URL || RABBITMQ_URL || 'amqp://video:video@rabbitmq:5672';
}

function getAmqplib() {
  if (amqp) return amqp;
  try {
    // eslint-disable-next-line global-require
    amqp = require('amqplib');
    return amqp;
  } catch (e) {
    if (isProd) {
      console.warn('[serviceUp] amqplib not installed:', e.message);
    } else {
      console.log('[serviceUp] amqplib unavailable (dev):', e.message);
    }
    return null;
  }
}

/**
 * Establish (or reuse) connection + channel with small timeout & retry.
 */
async function getChannel() {
  if (_chan) return _chan;
  if (_connecting) return _connecting;

  const amqplib = getAmqplib();
  if (!amqplib) return null;

  const url = getUrl();
  const timeoutMs = Number(process.env.AMQP_CONNECT_TIMEOUT_MS || 3000);
  const maxAttempts = Number(process.env.AMQP_CONNECT_ATTEMPTS || (isProd ? 5 : 1));
  const delayMs = Number(process.env.AMQP_CONNECT_BACKOFF_MS || 500);

  async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  _connecting = (async () => {
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const connPromise = amqplib.connect(url);
        const conn = await Promise.race([
          connPromise,
          new Promise((_, rej) => setTimeout(() => rej(new Error('AMQP connect timeout')), timeoutMs)),
        ]);

        conn.on('close', () => { _conn = null; _chan = null; _connecting = null; });
        conn.on('error', () => {}); // handled by close

        const ch = await conn.createChannel();
        _conn = conn;
        _chan = ch;
        return ch;
      } catch (err) {
        lastErr = err;
        const msg = String(err && err.message || err);
        const econRefused = /ECONNREFUSED|EHOSTUNREACH|ENOTFOUND/i.test(msg);

        if (!isProd && econRefused) {
          console.log(`[serviceUp] MQ unavailable (${url}) – attempt ${attempt}/${maxAttempts}; continuing dev without MQ`);
          break; // don’t keep retrying in dev
        }
        if (attempt < maxAttempts) await sleep(delayMs);
      }
    }
    _connecting = null;
    if (isProd) throw lastErr;
    return null; // dev: best effort
  })();

  try {
    return await _connecting;
  } finally {
    // allow next caller to reuse created channel or attempt a fresh connect if we failed
    if (_chan) _connecting = null;
  }
}

/**
 * main entry – publish service.up (best effort in dev)
 */
async function publishServiceUp(payload = {}) {
  const DEV_SKIP_MQ = process.env.DEV_SKIP_MQ === '1';
  if (!isProd && DEV_SKIP_MQ) {
    console.log('[serviceUp] DEV_SKIP_MQ=1 – skipping MQ publish');
    return;
  }

  const amqplib = getAmqplib();
  if (!amqplib) return;

  const {
    SERVICE_NAME = 'web-app',
    AMQP_EXCHANGE = 'events',
    AMQP_EXCHANGE_TYPE = 'topic',
    AMQP_ROUTING_KEY = 'service.up',
    AMQP_EXCHANGE_DURABLE = 'true',
  } = process.env;

  const msg = {
    type: 'service.up',
    service: SERVICE_NAME,
    ts: new Date().toISOString(),
    ...payload,
  };

  let ch;
  try {
    ch = await getChannel();
    if (!ch) return; // dev: quietly skip if MQ isn’t reachable

    await ch.assertExchange(AMQP_EXCHANGE, AMQP_EXCHANGE_TYPE, {
      durable: AMQP_EXCHANGE_DURABLE === 'true',
    });

    ch.publish(
      AMQP_EXCHANGE,
      AMQP_ROUTING_KEY,
      Buffer.from(JSON.stringify(msg)),
      { persistent: true }
    );

    if (!isProd) console.log('[serviceUp] published service.up (dev best-effort)');
  } catch (err) {
    const msg = String(err && err.message || err);
    const econRefused = /ECONNREFUSED|EHOSTUNREACH|ENOTFOUND/i.test(msg);

    if (!isProd && econRefused) {
      console.log('[serviceUp] MQ refused connection – continuing dev without MQ');
      return;
    }
    console.warn('[serviceUp] publish error:', msg);
  }
}

/**
 * Optional: graceful cleanup (call on process exit if you want)
 */
async function closeAmqp() {
  try { if (_chan) await _chan.close(); } catch {}
  try { if (_conn) await _conn.close(); } catch {}
  _chan = null; _conn = null; _connecting = null;
}

/**
 * Require an active RabbitMQ channel or throw.
 * Used during startup to ensure the broker is available.
 */
async function requireMq() {
  const ch = await getChannel();
  if (!ch) throw new Error('RabbitMQ connection required');
  return ch;
}

module.exports = { publishServiceUp, closeAmqp, requireMq };
