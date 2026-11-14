import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdultEligibility, resolveAdultEligibility } from '../src/utils/signupAge.js';

const at = value => new Date(value);
test('eligibility changes on the eighteenth birthday in India and keeps no birth date', () => {
  assert.throws(() => createAdultEligibility('2008-11-15', at('2026-11-14T18:29:59Z')), { code: 'AGE_NOT_ELIGIBLE' });
  const decision = createAdultEligibility('2008-11-15', at('2026-11-14T18:30:00Z'));
  assert.equal(decision.minimumAge, 18);
  assert.equal(decision.policyVersion, '2026-11-14');
  assert.equal(decision.checkedAt.toISOString(), '2026-11-14T18:30:00.000Z');
  assert.equal(JSON.stringify(decision).includes('2008-11-15'), false);
});
test('leap-day applicants reach the threshold on March 1 in non-leap years', () => {
  assert.throws(() => createAdultEligibility('2008-02-29', at('2026-02-28T12:00:00Z')), { code: 'AGE_NOT_ELIGIBLE' });
  assert.equal(createAdultEligibility('2008-02-29', at('2026-03-01T12:00:00Z')).minimumAge, 18);
});
test('missing, malformed, impossible, and future dates fail without accepting coercions', () => {
  assert.throws(() => createAdultEligibility(undefined), { code: 'AGE_ELIGIBILITY_REQUIRED' });
  for (const value of ['', null, 20000101, {}, ['2000-01-01'], '2000-1-1', '2000-01-01T00:00:00Z', '2001-02-29', '2024-02-30', '2000-13-01', '2999-01-01']) {
    assert.throws(() => createAdultEligibility(value), { code: 'INVALID_BIRTH_DATE' }, String(value));
  }
});
test('only a complete current stored decision can replace a fresh age check', () => {
  const now = at('2026-11-14T12:00:00Z');
  const decision = createAdultEligibility('2000-01-01', now);
  assert.deepEqual(resolveAdultEligibility(decision, undefined, now), decision);
  for (const invalid of [undefined, {}, { ...decision, minimumAge: 13 }, { ...decision, policyVersion: 'old' }, { ...decision, checkedAt: null }, { ...decision, checkedAt: at('2999-01-01') }]) {
    assert.throws(() => resolveAdultEligibility(invalid, undefined, now), { code: 'AGE_ELIGIBILITY_REQUIRED' });
    assert.equal(resolveAdultEligibility(invalid, '2000-01-01', now).minimumAge, 18);
  }
});
