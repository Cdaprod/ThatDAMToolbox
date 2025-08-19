let received;
const mock = {connect: async url => {received = url; return new MockConn();}};
require.cache[require.resolve('amqplib')] = {exports: mock};
const bus = require('./index');

class MockChannel {
  constructor(){ this.handlers = {}; }
  assertExchange(){ return Promise.resolve(); }
  publish(exchange, topic, body){ this.last = {exchange, topic, body}; return true; }
  assertQueue(){ return Promise.resolve({queue: 'q'}); }
  bindQueue(){ return Promise.resolve(); }
  consume(queue, fn){ this.handlers[queue] = fn; return Promise.resolve(); }
  close(){ return Promise.resolve(); }
}
class MockConn { createChannel(){ return Promise.resolve(new MockChannel()); } close(){ return Promise.resolve(); } }

(async () => {
  process.env.EVENT_BROKER_URL = 'amqp://test/';
  await bus.connect();
  if (received !== 'amqp://test/') throw new Error('url mismatch');
  await bus.publish('foo', {a:1});
  await bus.close();
  delete process.env.EVENT_BROKER_URL;
  console.log('ok');
})();
