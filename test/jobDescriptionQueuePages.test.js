import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteQueuePages } from '../rewriting/runner.js';

const collection = rows => {
  const calls = [];
  const Job = { find(filter) {
    const call = { filter }; calls.push(call);
    return { sort(value) { call.sort = value; return this; }, hint(value) { call.hint = value; return this; },
      lean() { return this; }, limit(value) { call.limit = value; return this; }, maxTimeMS(value) { call.maxTimeMS = value; return this; },
      async exec() {
        const after = filter.$and?.[1]._id.$gt || '';
        return rows.filter(row => row._id > after && row.status === 'active').slice(0, call.limit);
      }, cursor() { throw Error('An open database cursor must never cross inference'); } };
  } };
  return { Job, calls };
};

test('queue pages finish each indexed query before yielding and advance by _id', async () => {
  const rows = ['a','b','c','d','e'].map(_id => ({ _id, status: 'active' })), { Job, calls } = collection(rows);
  const iterator = rewriteQueuePages(Job, { status: 'active' }, { pageSize: 2 });
  assert.equal((await iterator.next()).value._id, 'a');
  assert.equal(calls.length, 1);
  // Changing a later source does not reorder or repeat previously handled IDs.
  rows[2].status = 'expired';
  const remaining = []; for await (const row of iterator) remaining.push(row._id);
  assert.deepEqual(remaining, ['b','d','e']);
  assert.deepEqual(calls[1].filter, { $and: [{ status: 'active' }, { _id: { $gt: 'b' } }] });
  assert.ok(calls.every(call => call.limit === 2 && call.maxTimeMS === 15000));
  assert.ok(calls.every(call => call.sort._id === 1 && call.hint._id === 1));
});

test('queue paging stops before another query on cancellation or deadline', async () => {
  const controller = new AbortController(), { Job, calls } = collection([{ _id: 'a', status: 'active' }]);
  const iterator = rewriteQueuePages(Job, {}, { pageSize: 1, signal: controller.signal });
  await iterator.next(); controller.abort();
  assert.equal((await iterator.next()).done, true); assert.equal(calls.length, 1);
  for await (const _row of rewriteQueuePages(Job, {}, { deadline: 0 })) assert.fail('Expired work must not load a page');
  assert.equal(calls.length, 1);
});

test('queue fetch failures keep database diagnostics and never masquerade as item warnings', async () => {
  const error = Object.assign(new Error('database query failed'), { code: 43, name: 'MongoServerError' });
  const Job = { find() { return { sort() { return this; }, hint() { return this; }, lean() { return this; },
    limit() { return this; }, maxTimeMS() { return this; }, exec: async () => { throw error; } }; } };
  await assert.rejects(async () => { for await (const _row of rewriteQueuePages(Job)) {} },
    value => value === error && value.rewritePhase === 'read_queue_page');
});
