import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeContentReport, normalizeReportReview, reportDeadline, reportListQuery } from '../src/services/contentReportPolicy.js';

const notice = { category: 'illegal_content', contentUrl: 'https://www.jobverify.in/jobs/507f1f77bcf86cd799439011',
  explanation: 'The listing requests an unlawful recruitment payment.', email: 'reporter@example.com', goodFaith: true };

test('notices retain only validated report fields and reject caller-owned workflow fields', () => {
  const value = normalizeContentReport(notice);
  assert.equal(value.category, 'illegal_content');
  assert.equal(value.email, 'reporter@example.com');
  assert.throws(() => normalizeContentReport({ ...notice, status: 'action_taken' }), { statusCode: 400 });
  assert.throws(() => normalizeContentReport({ ...notice, dueAt: '2099-01-01' }), { statusCode: 400 });
});

test('substantive notices require good faith, an explanation and a usable HTTP content link', () => {
  for (const change of [{ goodFaith: false }, { explanation: ' ' }, { contentUrl: 'javascript:alert(1)' },
    { contentUrl: 'https://name:password@example.com/private' }, { email: 'bad\r\n@example.com' }, { explanation: 'x'.repeat(5001) }]) {
    assert.throws(() => normalizeContentReport({ ...notice, ...change }), { statusCode: 400 });
  }
  assert.equal(normalizeContentReport({ ...notice, contentUrl: '/jobs/507f1f77bcf86cd799439011' }).contentUrl,
    'https://www.jobverify.in/jobs/507f1f77bcf86cd799439011');
});

test('urgent complaints accept minimal details and retain optional declarations without inventing them', () => {
  const minimal = normalizeContentReport({ ...notice, category: 'nonconsensual_intimate_imagery', email: '' });
  assert.equal(minimal.email, '');
  assert.equal(minimal.signature, '');
  assert.equal(minimal.authority, '');
  assert.equal(minimal.nonConsent, false);
  const declared = { ...notice, category: 'nonconsensual_intimate_imagery', signature: 'Example Reporter', authority: 'authorized_representative', nonConsent: true };
  assert.equal(normalizeContentReport(declared).nonConsent, true);
  assert.equal(normalizeContentReport(declared).signature, 'Example Reporter');
  assert.throws(() => normalizeContentReport({ ...declared, authority: 'stranger' }), { statusCode: 400 });
  assert.throws(() => normalizeContentReport({ ...declared, nonConsent: 'yes' }), { statusCode: 400 });
});

test('child-safety notices allow reporting without contact details; appeals require the prior reference', () => {
  assert.equal(normalizeContentReport({ ...notice, category: 'child_safety', email: '' }).email, '');
  assert.throws(() => normalizeContentReport({ ...notice, email: '' }), { statusCode: 400 });
  assert.throws(() => normalizeContentReport({ ...notice, category: 'appeal' }), { statusCode: 400 });
  assert.equal(normalizeContentReport({ ...notice, category: 'appeal', relatedReference: 'e7c9bd9b-71c1-4ad6-8c84-d30b74e2a64a' }).relatedReference,
    'e7c9bd9b-71c1-4ad6-8c84-d30b74e2a64a');
});

test('priority deadlines are two hours from receipt and never reset when a notice is reviewed', () => {
  const received = new Date('2026-11-14T12:00:00Z');
  assert.equal(reportDeadline(received).toISOString(), '2026-11-14T14:00:00.000Z');
  assert.equal(received.toISOString(), '2026-11-14T12:00:00.000Z');
});

test('queue pagination is bounded and filters cannot inject Mongo operators', () => {
  assert.deepEqual(reportListQuery({}), { page: 1, limit: 20, status: 'open' });
  for (const query of [{ page: '-1' }, { limit: '100000' }, { status: { $ne: 'action_taken' } }, { status: 'invented' }]) {
    assert.throws(() => reportListQuery(query), { statusCode: 400 });
  }
});

test('reviews require an expected revision and a reason; actioned NCII requires the copies check', () => {
  const review = { status: 'action_taken', expectedRevision: 0, notes: 'Removed the reported item and checked known identical copies.', copiesChecked: true };
  assert.equal(normalizeReportReview(review, 'nonconsensual_intimate_imagery').copiesChecked, true);
  for (const change of [{ expectedRevision: -1 }, { notes: '' }, { status: 'invented' }, { copiesChecked: false }]) {
    assert.throws(() => normalizeReportReview({ ...review, ...change }, 'nonconsensual_intimate_imagery'), { statusCode: 400 });
  }
  assert.throws(() => normalizeReportReview({ ...review, dueAt: '2099-01-01' }, 'illegal_content'), { statusCode: 400 });
});
