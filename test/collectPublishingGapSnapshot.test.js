import assert from 'node:assert/strict';
import test from 'node:test';
import { collectPublishingGapSnapshot, readPublishingGapSnapshot } from '../scripts/collectPublishingGapSnapshot.js';
import { applyPublicJobVisibility } from '../src/utils/publicJobVisibility.js';

const now = new Date('2026-10-20T09:00:00Z');
function fixture({ fail = false } = {}) {
  const calls = [];
  const database = { collection(name) {
    return {
      async findOne(query, options) {
        calls.push({ name, operation: 'findOne', query, options });
        if (fail) throw new Error('mongodb://secret:password@private.example');
        return { experiencedJobsEnabled: false };
      },
      find(query, options) {
        calls.push({ name, operation: 'find', query, options });
        return { toArray: async () => [{ source: 'registered', lastSuccess: true }] };
      },
      aggregate(pipeline, options) {
        calls.push({ name, operation: 'aggregate', pipeline, options });
        return { toArray: async () => pipeline[0].$match
          ? [{ sources: [{ _id: 'untracked', visibleJobs: 2, visibleCompanies: ['Acme', ''] }], companies: [{ _id: 'acme', label: 'Acme' }] }]
          : [{ _id: 'untracked', savedJobs: 3 }, { _id: null, savedJobs: 1 }, { _id: 'old', savedJobs: 4 }] };
      },
    };
  } };
  return { database, calls };
}

test('snapshot shares dashboard visibility, preserves unknown historical fields and includes untracked inventory', async t => {
  t.mock.timers.enable({ apis: ['Date'], now });
  const { database, calls } = fixture();
  const snapshot = await collectPublishingGapSnapshot({ database, now });
  assert.equal(snapshot.databaseAvailable, true);
  assert.equal(snapshot.generatedAt, now.toISOString());
  assert.equal(Object.hasOwn(snapshot.statuses[0], 'lastJobsFound'), false);
  assert.deepEqual(snapshot.publicCompanyNames, ['Acme']);
  assert.deepEqual(snapshot.inventory.find(row => row.source === 'untracked'), {
    source: 'untracked', savedJobs: 3, visibleJobs: 2, visibleCompanies: ['Acme'],
  });
  assert.equal(snapshot.inventory.find(row => row.source === null).savedJobs, 1);
  assert.equal(snapshot.inventory.find(row => row.source === 'old').visibleJobs, 0);
  const visible = calls.find(call => call.pipeline?.[0].$match);
  assert.deepEqual(visible.pipeline[0].$match, applyPublicJobVisibility({
    status: 'active', $or: [{ closingDate: null }, { closingDate: { $gt: now } }],
  }, snapshot.siteSettings));
  assert.deepEqual(calls.find(call => call.operation === 'find').query, { source: { $ne: '__pipeline__' } });
  assert.ok(calls.every(call => call.options.maxTimeMS > 0));
});

test('query failures invalidate snapshot and never expose connection details or turn missing inventory into zero', async () => {
  const snapshot = await collectPublishingGapSnapshot({ database: fixture({ fail: true }).database, now });
  assert.deepEqual(snapshot, {
    generatedAt: now.toISOString(), databaseAvailable: false, errorKind: 'database_unavailable',
    siteSettings: null, statuses: null, inventory: null, publicCompanyNames: null,
  });
  assert.doesNotMatch(JSON.stringify(snapshot), /secret|password|private\.example|mongodb/);
});

test('unavailable database produces unknown inventory', async () => {
  const snapshot = await collectPublishingGapSnapshot({ database: null, now });
  assert.equal(snapshot.databaseAvailable, false);
  assert.equal(snapshot.inventory, null);
});

test('owned connection disables collection and index creation and always disconnects', async () => {
  let disconnected = 0;
  const connector = {
    connection: { db: fixture().database },
    async connect(uri, options) {
      assert.equal(uri, 'test-uri');
      assert.deepEqual(options, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    },
    async disconnect() { disconnected += 1; },
  };
  assert.equal((await readPublishingGapSnapshot({ now, connector, uri: 'test-uri' })).databaseAvailable, true);
  assert.equal(disconnected, 1);
  connector.connect = async () => { throw new Error('mongodb://secret:password@private.example'); };
  const failed = await readPublishingGapSnapshot({ now, connector, uri: 'test-uri' });
  assert.equal(failed.databaseAvailable, false);
  assert.equal(disconnected, 2);
  assert.doesNotMatch(JSON.stringify(failed), /secret|password|private\.example|mongodb/);
});
