import assert from 'node:assert/strict';
import test from 'node:test';
import { getAuthCookieOptions } from '../src/utils/authCookies.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

test('production spelling accepted by startup always enables secure cookies and safe client errors', t => {
  const original = process.env.NODE_ENV;
  t.after(() => { if (original === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original; });
  t.mock.method(console, 'error', () => {});
  for (const value of ['production', ' PRODUCTION ', 'Production']) {
    process.env.NODE_ENV = value;
    assert.equal(getAuthCookieOptions().secure, true, value);
    assert.equal(getAuthCookieOptions().httpOnly, true);
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    errorHandler(new Error('private diagnostic details'), {}, res, () => assert.fail('Must respond'));
    assert.equal(res.code, 500);
    assert.deepEqual(res.body, { success: false, message: 'Internal Server Error' });
  }
});

test('development keeps local cookie compatibility', t => {
  const original = process.env.NODE_ENV;
  t.after(() => { if (original === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original; });
  process.env.NODE_ENV = 'development';
  assert.equal(getAuthCookieOptions().secure, false);
  assert.equal(getAuthCookieOptions().sameSite, 'lax');
});
