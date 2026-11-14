import assert from 'node:assert/strict';
import test from 'node:test';
import { createContentReportHandlers } from '../src/controllers/contentReportController.js';

const notice = { category: 'illegal_content', contentUrl: '/jobs/507f1f77bcf86cd799439011',
  explanation: 'The listing requests an unlawful recruitment payment.', email: 'reporter@example.com', goodFaith: true };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('a saved notice acknowledges only its reference and server-owned receipt/deadline', async () => {
  let saved;
  const handlers = createContentReportHandlers({ now: () => new Date('2026-11-14T12:00:00Z'),
    Report: { create: async row => { saved = row; return row; } } });
  const res = response();
  await handlers.submit({ body: notice }, res);
  assert.equal(res.statusCode, 201);
  assert.match(res.body.data.reference, /^[a-f0-9-]{36}$/);
  assert.equal(res.body.data.dueAt.toISOString(), '2026-11-14T14:00:00.000Z');
  assert.equal(saved.email, notice.email);
  assert.equal(saved.status, 'received');
  assert.equal(res.body.data.email, undefined);
  assert.equal(res.body.data.explanation, undefined);
});

test('failed storage never reports a successful receipt or leaks database/report details', async () => {
  const handlers = createContentReportHandlers({ Report: { create: async () => { throw new Error('database password and reporter@example.com'); } } });
  const res = response();
  await handlers.submit({ body: notice }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
  assert.doesNotMatch(JSON.stringify(res.body), /password|reporter@example/);
});

test('stale admin updates cannot overwrite an existing review', async () => {
  let updated = false;
  const handlers = createContentReportHandlers({ Report: {
    findById: () => ({ select: () => ({ lean: async () => ({ _id: 'e7c9bd9b-71c1-4ad6-8c84-d30b74e2a64a', category: 'illegal_content', revision: 2 }) }) }),
    findOneAndUpdate: () => { updated = true; throw new Error('must not overwrite'); },
  } });
  const res = response();
  await handlers.review({ params: { reference: 'e7c9bd9b-71c1-4ad6-8c84-d30b74e2a64a' }, user: { _id: 'admin' },
    body: { status: 'reviewing', expectedRevision: 1, notes: 'Investigating the reported content.' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(updated, false);
});

test('review writes preserve the original deadline and retain actor/reason in an atomic history append', async () => {
  const id = 'e7c9bd9b-71c1-4ad6-8c84-d30b74e2a64a';
  let mutation;
  const handlers = createContentReportHandlers({ Report: {
    findById: () => ({ select: () => ({ lean: async () => ({ _id: id, category: 'illegal_content', revision: 0 }) }) }),
    findOneAndUpdate: (filter, update) => { mutation = { filter, update }; return { lean: async () => ({ _id: id, status: 'reviewing', revision: 1 }) }; },
  } });
  const res = response();
  await handlers.review({ params: { reference: id }, user: { _id: 'synthetic-admin' },
    body: { status: 'reviewing', expectedRevision: 0, notes: 'Investigating the reported content.' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(mutation.filter, { _id: id, revision: 0 });
  assert.equal(mutation.update.$set.dueAt, undefined);
  assert.equal(mutation.update.$push.history.actor, 'synthetic-admin');
  assert.equal(mutation.update.$push.history.notes, 'Investigating the reported content.');
  assert.deepEqual(mutation.update.$inc, { revision: 1 });
});
