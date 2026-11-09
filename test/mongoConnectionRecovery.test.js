import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import JobAlertOutbox from '../src/models/JobAlertOutbox.js';
import connectDB from '../db/db.js';

test('scraper connection recovery preserves transaction ownership', { timeout: 90_000 }, async t => {
  const mongo = new MongoMemoryReplSet({
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) },
    instanceOpts: [{ launchTimeout: 30_000 }],
    replSet: { count: 1, spawn: { signal: t.signal } },
  });
  const initialUri = process.env.MONGO_URI;
  const retainedClients = new Set();
  let startup;
  t.after(async () => {
    if (initialUri === undefined) delete process.env.MONGO_URI;
    else process.env.MONGO_URI = initialUri;
    await mongoose.disconnect();
    await Promise.allSettled([...retainedClients].map(client => client.close()));
    await mongo.stop({ doCleanup: false });
    await startup?.catch(() => {});
    await mongo.stop();
  });
  startup = mongo.start();
  await startup;
  t.signal.throwIfAborted();
  process.env.MONGO_URI = mongo.getUri('scraper_connection_recovery');
  await connectDB();
  await Promise.all([Job.init(), JobAlertOutbox.init()]);

  await t.test('successful recovery restores Mongoose readiness after a stale heartbeat', async () => {
    const connection = mongoose.connection;
    const client = connection.getClient();
    connection._lastHeartbeatAt = Date.now() - 60_000;
    assert.equal(connection.readyState, 0);
    try {
      await connectDB();
      assert.equal(connection.readyState, 1);
      assert.equal(connection.getClient(), client);
      const session = await connection.startSession();
      try { assert.equal(await Job.countDocuments().session(session), 0); }
      finally { await session.endSession(); }
    } finally {
      connection._lastHeartbeatAt = null;
      connection.onOpen();
    }
  });

  await t.test('recovery releases session startup already buffered during a stale heartbeat', async () => {
    const connection = mongoose.connection;
    const initialTimeout = connection.config.bufferTimeoutMS;
    connection.config.bufferTimeoutMS = 1500;
    connection._lastHeartbeatAt = Date.now() - 60_000;
    const pendingSession = connection.startSession();
    pendingSession.catch(() => {});
    try {
      await connectDB();
      const session = await pendingSession;
      await session.endSession();
    } finally {
      connection.config.bufferTimeoutMS = initialTimeout;
      connection._lastHeartbeatAt = null;
      connection.onOpen();
      await pendingSession.then(session => session.endSession(), () => {});
    }
  });

  await t.test('an active connection rejects a different database URI rather than using the old database', async () => {
    const uri = process.env.MONGO_URI;
    try {
      process.env.MONGO_URI = mongo.getUri('different_database');
      await assert.rejects(connectDB(), /different connection strings/);
    } finally {
      process.env.MONGO_URI = uri;
    }
  });

  await t.test('a heartbeat disconnect cannot replace the client of an active job transaction', async () => {
    const connection = mongoose.connection;
    const client = connection.getClient();
    retainedClients.add(client);
    await connection.transaction(async session => {
      // Mongoose reports readyState 0 when a heartbeat loses the primary,
      // even though the driver still owns a live, automatically recovering pool.
      connection.readyState = 0;
      try {
        assert.equal(await connectDB(), mongoose);
      } finally {
        retainedClients.add(connection.getClient());
      }
      assert.equal(connection.readyState, 1, 'The recovery helper must restore readiness before writes resume');
      assert.equal(connection.getClient(), client, 'Recovery must not replace the client behind an active session');
      const [job] = await Job.create([{ fingerprint: 'connection-recovery', title: 'Engineer', company: 'Example' }], { session });
      await JobAlertOutbox.create([{ job: job._id }], { session });
    });
    assert.equal(await Job.countDocuments({ fingerprint: 'connection-recovery' }), 1);
    assert.equal(await JobAlertOutbox.countDocuments({ status: 'pending' }), 1);
  });

  await t.test('an unavailable existing pool propagates recovery failure without replacing its client', async () => {
    const connection = mongoose.connection;
    const client = connection.getClient();
    const failure = Object.assign(new Error('Local recovery unavailable'), { name: 'MongoServerSelectionError' });
    const command = t.mock.method(connection.db, 'command', async () => { throw failure; });
    connection.readyState = 0;
    try {
      await assert.rejects(connectDB(), error => error === failure);
      assert.equal(connection.getClient(), client);
    } finally {
      retainedClients.add(connection.getClient());
      command.mock.restore();
      connection.onOpen();
    }
  });

  await t.test('simultaneous initial callers share initialization and explicit close allows reopening', async () => {
    const previous = mongoose.connection.getClient();
    await mongoose.disconnect();
    const originalConnect = mongoose.connect.bind(mongoose);
    let attempts = 0;
    const connect = t.mock.method(mongoose, 'connect', async (...args) => {
      attempts++;
      await new Promise(resolve => setImmediate(resolve));
      const result = await originalConnect(...args);
      retainedClients.add(result.connection.getClient());
      return result;
    });
    try {
      const results = await Promise.all([connectDB(), connectDB(), connectDB()]);
      assert.equal(attempts, 1, 'Parallel sources must share one connection initialization');
      assert.ok(results.every(result => result === mongoose));
      assert.notEqual(mongoose.connection.getClient(), previous);
      assert.equal(await Job.countDocuments({ fingerprint: 'connection-recovery' }), 1);
    } finally {
      connect.mock.restore();
    }
  });
});
