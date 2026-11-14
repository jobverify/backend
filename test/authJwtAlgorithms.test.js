import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';

process.env.JWT_SECRET = 'jwt-algorithm-regression-secret-at-least-32-characters';
const { protect, protectLogout, optionalProtect } = await import('../src/middleware/authMiddleware.js');
const owner = '507f1f77bcf86cd799439011';
const response = () => ({
  statusCode: 200, cleared: [],
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  clearCookie(name) { this.cleared.push(name); return this; },
});

for (const algorithm of ['HS256', 'HS384', 'HS512']) {
  test(`required authentication only accepts HS256: ${algorithm}`, async t => {
    t.mock.method(BlacklistedToken, 'findOne', async () => null);
    t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: owner, sessionVersion: 2, isVerified: true }) }));
    const token = jwt.sign({ id: owner, sessionVersion: 2 }, process.env.JWT_SECRET, { algorithm });
    for (const middleware of [protect, protectLogout]) {
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = response(); let passed = false;
      await middleware(req, res, () => { passed = true; });
      assert.equal(passed, algorithm === 'HS256');
      assert.equal(res.statusCode, algorithm === 'HS256' ? 200 : 401);
      if (middleware === protectLogout) assert.ok(res.cleared.includes('jobverify_token'));
    }
  });

  test(`optional authentication ignores unsupported JWT algorithms: ${algorithm}`, async t => {
    t.mock.method(BlacklistedToken, 'findOne', async () => null);
    t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: owner, sessionVersion: 2, isVerified: true }) }));
    const token = jwt.sign({ id: owner, sessionVersion: 2 }, process.env.JWT_SECRET, { algorithm });
    const req = { headers: { authorization: `Bearer ${token}` } }; let passed = false;
    await optionalProtect(req, response(), () => { passed = true; });
    assert.equal(passed, true);
    assert.equal(req.user?._id, algorithm === 'HS256' ? owner : undefined);
  });
}
