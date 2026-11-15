import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
import SiteSettings from '../src/models/SiteSettings.js';
import Application from '../src/models/Application.js';
import { buildAccessSummary } from '../src/utils/accessControl.js';

process.env.JWT_SECRET = 'telegram-admin-access-test-secret-at-least-32-characters';
const { default: userRoutes } = await import('../src/routes/userRoutes.js');
const { default: adminRoutes } = await import('../src/routes/adminRoutes.js');

test('new users and legacy disabled accounts always have applications enabled', () => {
  assert.equal(new User({ email: 'new@example.test' }).applicationsAllowed, true);
  assert.equal(buildAccessSummary({ applicationsAllowed: false }).applicationsAllowed, true);
});

test('all verified users can access applications and the admin toggle endpoint is retired', async t => {
  const admin = new User({ email: 'admin@example.test', role: 'admin', isVerified: true });
  const member = new User({ email: 'member@example.test', isVerified: true, applicationsAllowed: false });
  t.mock.method(SiteSettings, 'findById', () => ({ lean: async () => ({ billingEnabled: false }) }));
  t.mock.method(BlacklistedToken, 'findOne', async () => null);
  t.mock.method(User, 'findById', id => {
    const user = String(id) === String(admin._id) ? admin : member;
    return Object.assign(Promise.resolve(user), { select: async () => user });
  });
  t.mock.method(Application, 'aggregate', async () => [{ items: [], counts: [], stageCounts: [], filteredCounts: [] }]);
  t.mock.method(Application, 'findOne', () => ({ lean: async () => null }));
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/user', userRoutes);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = (user, path, method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method, headers: { ...(user ? { authorization: `Bearer ${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}` } : {}), 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const adminPath = `/api/admin/users/${member._id}/applications-access`;
  assert.equal((await request(null, '/api/user/applications')).status, 401);
  for (const user of [member, admin]) {
    const applications = await request(user, '/api/user/applications');
    assert.equal(applications.status, 200);
    assert.deepEqual((await applications.json()).data, []);
    assert.equal((await request(user, `/api/user/applications/job/${member._id}`)).status, 200);
  }
  for (const [path, method, body] of [
    ['/applications/job/example', 'GET'],
    ['/applications/example/applied', 'PUT'], ['/applications/example/events', 'GET'],
    ['/applications/example/stage', 'PUT', {}], ['/applications/job/example/stage', 'PUT', {}],
  ]) {
    const response = await request(member, `/api/user${path}`, method, body);
    assert.equal(response.status, 400, `${method} ${path} validates input instead of applying an access flag`);
  }
  for (const enabled of [false, true]) {
    assert.equal((await request(admin, adminPath, 'PUT', { enabled })).status, 404);
  }
  assert.equal(buildAccessSummary(member).applicationsAllowed, true);
  assert.equal(member.resumeFeaturesAllowed, false);
  assert.equal(buildAccessSummary({}).applicationsAllowed, true);
});
