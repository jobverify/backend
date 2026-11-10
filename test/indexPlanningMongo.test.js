import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

test('index plan and apply --dry-run issue no DDL on a new database', { timeout: 90000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(() => mongo.stop());
  for (const mode of ['plan', 'apply']) {
    const result = await promisify(execFile)(process.execPath,
      [fileURLToPath(new URL('./helpers/indexPlannerChild.js', import.meta.url)), mode], {
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'test', MONGO_URI: mongo.getUri(`planner_${mode}`) },
        timeout: 40000,
      });
    assert.equal(result.stderr, '');
  }
});
