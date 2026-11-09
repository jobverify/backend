import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import tls from 'node:tls';
import { openGmailSocket } from '../src/gmailSocket.js';

function mockSocket(t) {
  const socket = new EventEmitter();
  socket.destroy = () => { socket.destroyed = true; };
  let options;
  t.mock.method(tls, 'connect', value => { options = value; return socket; });
  return { socket, getOptions: () => options };
}

test('Gmail socket uses a hostname and supplies a verified TLS connection after the handshake', t => {
  const { socket, getOptions } = mockSocket(t);
  const results = [];
  openGmailSocket({}, (...args) => results.push(args));
  assert.equal(results.length, 0);
  assert.deepEqual(getOptions(), {
    host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com', rejectUnauthorized: true,
  });
  socket.emit('secureConnect');
  assert.equal(results.length, 1);
  assert.equal(results[0][0], null);
  assert.deepEqual(results[0][1], { connection: socket, secured: true });
  socket.emit('error', new Error('late socket error'));
  assert.equal(results.length, 1);
});

test('Gmail socket errors destroy the connection and invoke its callback once', t => {
  const { socket } = mockSocket(t);
  const results = [];
  openGmailSocket({}, (...args) => results.push(args));
  const error = new Error('TLS failed');
  socket.emit('error', error);
  socket.emit('secureConnect');
  assert.equal(results.length, 1);
  assert.equal(results[0][0], error);
  assert.equal(socket.destroyed, true);
});

test('Gmail socket handshake has a ten-second deadline and rejects a late connection', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { socket } = mockSocket(t);
  const results = [];
  openGmailSocket({}, (...args) => results.push(args));
  t.mock.timers.tick(10_000);
  assert.equal(results.length, 1);
  assert.equal(results[0][0].code, 'ETIMEDOUT');
  assert.equal(socket.destroyed, true);
  socket.emit('secureConnect');
  assert.equal(results.length, 1);
});

test('Gmail socket construction failures are returned without an unhandled rejection', t => {
  const error = new Error('Runtime connection failed');
  t.mock.method(tls, 'connect', () => { throw error; });
  let result;
  openGmailSocket({}, value => { result = value; });
  assert.equal(result, error);
});
