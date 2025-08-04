import amqplib from 'amqplib';

export async function publishServiceUp(): Promise<void> {
  const url = process.env.EVENT_BROKER_URL || process.env.AMQP_URL || 'amqp://guest:guest@localhost:5672/';
  const exchange = process.env.BROKER_EXCHANGE || 'events';
  const routingKey = 'webapp.service_up';

  try {
    const connection = await amqplib.connect(url);
    const channel = await connection.createChannel();
    await channel.assertExchange(exchange, 'topic', { durable: true });

    const message = {
      topic: routingKey,
      ts: Math.floor(Date.now() / 1000),
      payload: { service: 'web-app' }
    };

    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)));
    await channel.close();
    await connection.close();
    console.log(`[event] published ${routingKey}`);
  } catch (err) {
    console.error('[event] publish failed', err);
  }
}

if (require.main === module) {
  publishServiceUp().then(() => process.exit(0)).catch(() => process.exit(1));
}