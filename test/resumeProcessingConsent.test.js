import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import Resume from '../src/models/Resume.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
import SiteSettings from '../src/models/SiteSettings.js';

process.env.JWT_SECRET = 'resume-consent-synthetic-test-key-at-least-32-characters';
const { default: userRoutes } = await import('../src/routes/userRoutes.js');

test('resume AI routes require current explicit consent before validating or scheduling generation', async t => {
  const user = new User({ email: 'consent-test@gmail.com', resumeFeaturesAllowed: true });
  t.mock.method(BlacklistedToken, 'findOne', async () => null);
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  t.mock.method(SiteSettings, 'findById', () => ({ lean: async () => ({ billingEnabled: false }) }));
  t.mock.method(Resume, 'findOne', () => ({ lean: async () => null }));
  const app = express();
  app.use(express.json());
  app.use('/api/user', userRoutes);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const authorization = `Bearer ${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}`;
  for (const path of ['/resume/prepare', '/tailored-resumes/507f1f77bcf86cd799439011']) {
    for (const processingConsent of [undefined, false, true, '2025-01-01', {}, { version: '2026-11-14', accepted: false }]) {
      const response = await fetch(`${origin}/api/user${path}`, {
        method: 'POST', headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({ regenerate: 'invalid', processingConsent }),
      });
      assert.equal(response.status, 428, `${path} must reject ${JSON.stringify(processingConsent)} before generation`);
      assert.equal((await response.json()).code, 'RESUME_PROCESSING_CONSENT_REQUIRED');
    }
    const accepted = await fetch(`${origin}/api/user${path}`, {
      method: 'POST', headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ regenerate: 'invalid', processingConsent: { version: '2026-11-14', accepted: true } }),
    });
    assert.equal(accepted.status, 400, 'accepted consent must reach normal input validation');
    assert.match((await accepted.json()).message, /Regenerate/);
  }
  const original = await fetch(`${origin}/api/user/resume`, { headers: { authorization } });
  assert.equal(original.status, 200, 'reading an original must not require AI consent');
  const anonymous = await fetch(`${origin}/api/user/resume/prepare`, { method: 'POST' });
  assert.equal(anonymous.status, 401, 'consent never replaces authentication');
});
