import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
process.env.JWT_SECRET = 'verification-fixture-secret-that-is-at-least-32-characters';
const { createVerificationRouter } = await import('../src/routes/jobVerificationRoutes.js').catch(() => ({}));

test('verification API requires a session and exposes no cacheable report responses', async t => {
  assert.equal(typeof createVerificationRouter, 'function');
  const owner = '507f1f77bcf86cd799439011';
  t.mock.method(User, 'findById', id => ({ select: async () => ({ _id: id, role: 'user' }) }));
  t.mock.method(BlacklistedToken, 'findOne', async () => null);
  const app = express(); app.use(express.json());
  app.use('/api/job-verifications', createVerificationRouter({ service: {
    submit: async (id, body) => ({ id: 'report-1', status: 'queued', owner: String(id), submittedUrl: body.url }),
    list: async id => ({ items: [{ id: 'report-1', owner: String(id) }], pagination: { page: 1, totalPages: 1 } }),
    get: async () => { throw Object.assign(new Error('Report not found.'), { status: 404, code: 'report_not_found' }); },
    remove: async () => {},
  } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/job-verifications`;
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com' }) })).status, 401);
    const headers = { authorization: `Bearer ${jwt.sign({ id: owner }, process.env.JWT_SECRET)}`, 'content-type': 'application/json' };
    const created = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ url: 'https://example.com/jobs/1' }) });
    assert.equal(created.status, 202); assert.equal(created.headers.get('cache-control'), 'no-store');
    assert.equal((await created.json()).data.owner, owner);
    const list = await fetch(base, { headers }); assert.equal((await list.json()).data.items[0].owner, owner);
    const missing = await fetch(`${base}/507f1f77bcf86cd799439012`, { headers });
    assert.equal(missing.status, 404); assert.equal((await missing.json()).error, 'report_not_found');
    assert.equal((await fetch(`${base}/507f1f77bcf86cd799439012`, { method: 'DELETE', headers })).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
