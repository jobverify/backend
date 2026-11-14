import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';
import ContentReport from '../src/models/ContentReport.js';

test('anonymous visitors can submit a CSRF-protected notice but cannot read or update the queue', { timeout: 15000 }, async () => {
  const originalCreate = ContentReport.create;
  const previous = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET, CORS_ORIGIN: process.env.CORS_ORIGIN };
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'synthetic-compliance-session-secret-0000000000000000', CORS_ORIGIN: 'http://127.0.0.1:5173' });
  const saved = [];
  ContentReport.create = async row => { saved.push(row); return row; };
  const server = createServer(createApp());
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const tokenReply = await fetch(origin + '/api/auth/csrf-token');
    const { token } = await tokenReply.json();
    const cookies = tokenReply.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const headers = { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json', 'X-CSRF-Token': token, Cookie: cookies };
    const body = { category: 'illegal_content', contentUrl: '/jobs/507f1f77bcf86cd799439011', explanation: 'A synthetic listing requests an unlawful fee.', email: 'reporter@example.test', goodFaith: true };
    const reply = await fetch(origin + '/api/content-reports', { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(reply.status, 201);
    const receipt = await reply.json();
    assert.equal(saved.length, 1);
    assert.equal(receipt.data.reference, saved[0]._id);
    assert.equal(receipt.data.email, undefined);
    assert.equal((await fetch(origin + '/api/content-reports')).status, 404);
    assert.equal((await fetch(origin + '/api/admin/content-reports')).status, 401);
    const review = await fetch(origin + '/api/admin/content-reports/' + receipt.data.reference, { method: 'PUT', headers,
      body: JSON.stringify({ status: 'action_taken', notes: 'Unprivileged client must not change this.', expectedRevision: 0 }) });
    assert.equal(review.status, 401);
    const unsigned = await fetch(origin + '/api/content-reports', { method: 'POST', headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(unsigned.status, 403);
    assert.equal(saved.length, 1);
    const security = await fetch(origin + '/.well-known/security.txt');
    assert.equal(security.status, 200);
    assert.match(security.headers.get('content-type'), /text\/plain.*charset=utf-8/i);
    assert.match(await security.text(), /Contact: mailto:jobverify.in@gmail.com/);
    const urgent = await fetch(origin + '/api/content-reports', { method: 'POST', headers,
      body: JSON.stringify({ category: 'nonconsensual_intimate_imagery', contentUrl: '/example', explanation: 'Synthetic urgent impersonation complaint.', goodFaith: true }) });
    assert.equal(urgent.status, 201);
    assert.equal(saved.length, 2);
    assert.equal(saved[1].email, '');
    assert.equal(saved[1].signature, '');
    assert.equal(saved[1].authority, '');
    assert.equal(saved[1].nonConsent, false);
    assert.equal(saved[1].dueAt.getTime() - saved[1].receivedAt.getTime(), 2 * 60 * 60 * 1000);
  } finally {
    ContentReport.create = originalCreate;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});
