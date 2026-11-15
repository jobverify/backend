import assert from 'node:assert/strict';
import test from 'node:test';
import User from '../src/models/User.js';
import { validationResult } from 'express-validator';
import { userProfileValidation } from '../src/validation/requestValidators.js';
import { getUserProfile, updateUserProfile } from '../src/controllers/userController.js';

test('new accounts receive a pending guide independently of profile completion', () => {
  const user = new User({ email: 'new-guide@example.test' });
  assert.equal(user.gettingStartedStatus, 'pending');
  user.onboardingCompleted = true;
  assert.equal(user.gettingStartedStatus, 'pending');
});

test('existing completed accounts do not receive a new welcome prompt', () => {
  const user = User.hydrate({ email: 'returning@example.test', onboardingCompleted: true });
  assert.equal(user.gettingStartedStatus, 'completed');
});

test('existing incomplete accounts can opt into the guide', () => {
  const user = User.hydrate({ email: 'incomplete@example.test', onboardingCompleted: false });
  assert.equal(user.gettingStartedStatus, 'pending');
});

test('guide choices survive profile updates and database hydration', () => {
  for (const status of ['in_progress', 'skipped', 'completed']) {
    const user = User.hydrate({ email: 'guide@example.test', onboardingCompleted: false, gettingStartedStatus: status });
    assert.equal(user.gettingStartedStatus, status);
    user.onboardingCompleted = true;
    assert.equal(user.gettingStartedStatus, status);
  }
});

test('invalid guide states are rejected by the account schema', () => {
  const user = new User({ email: 'guide@example.test', gettingStartedStatus: 'anything' });
  assert.equal(user.validateSync()?.errors.gettingStartedStatus?.kind, 'enum');
});


test('profile updates validate guide status without accepting arbitrary values', async () => {
  for (const value of ['pending', 'in_progress', 'skipped', 'completed', 'invalid', null, 1, [], {}]) {
    const req = { body: { gettingStartedStatus: value } };
    for (const rule of userProfileValidation) await rule.run(req);
    const errors = validationResult(req).array().filter(error => error.path === 'gettingStartedStatus');
    assert.equal(errors.length === 0, ['pending', 'in_progress', 'skipped', 'completed'].includes(value));
  }
});

test('the profile API persists Skip and returns the choice on later reads', async t => {
  const user = new User({ email: 'skipped-guide@example.test' });
  t.mock.method(User, 'findById', async () => user);
  t.mock.method(user, 'save', async () => user);
  let response;
  const res = { status(code) { assert.equal(code, 200); return this; }, json(body) { response = body; return this; } };
  await updateUserProfile({ user: { _id: user._id }, body: { gettingStartedStatus: 'skipped' } }, res);
  assert.equal(user.gettingStartedStatus, 'skipped');
  assert.equal(response.gettingStartedStatus, 'skipped');
  await updateUserProfile({ user: { _id: user._id }, body: { name: 'Updated name' } }, res);
  await getUserProfile({ user: { _id: user._id } }, res);
  assert.equal(response.gettingStartedStatus, 'skipped');
  assert.equal(response.profile.name, 'Updated name');
});
