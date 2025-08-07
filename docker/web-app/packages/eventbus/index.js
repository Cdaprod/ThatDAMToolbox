// Minimal event bus facade for Node services.
// Example:
// const bus = await connect();
// await publish('topic', {a:1});

const amqplib = require('amqplib');

let connection; let channel; let exchange = 'events';

async function connect(url = process.env.AMQP_URL || 'amqp://localhost/', ex = process.env.AMQP_EXCHANGE || 'events') {
  if (!connection) {
    exchange = ex;
    connection = await amqplib.connect(url);
    channel = await connection.createChannel();
    await channel.assertExchange(exchange, 'topic', {durable: true});
  }
  return {publish, subscribe, close};
}

async function publish(topic, payload) {
  if (!channel) throw new Error('bus not connected');
  const body = Buffer.from(JSON.stringify(payload));
  return channel.publish(exchange, topic, body);
}

async function subscribe(topic, handler) {
  if (!channel) throw new Error('bus not connected');
  const q = await channel.assertQueue('', {exclusive: true});
  await channel.bindQueue(q.queue, exchange, topic);
  await channel.consume(q.queue, msg => { handler(msg.content); }, {noAck: true});
}

async function close() {
  if (connection) {
    await channel.close();
    await connection.close();
    connection = null; channel = null;
  }
}

module.exports = {connect, publish, subscribe, close};
