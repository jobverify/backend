import assert from 'node:assert/strict';
import test from 'node:test';
import { validationResult } from 'express-validator';
import { userProfileValidation, registerValidation } from '../src/validation/requestValidators.js';

async function errorsFor(body, rules = userProfileValidation) {
  const req = { body };
  for (const rule of rules) await rule.run(req);
  return validationResult(req).array();
}

for (const branch of ['', '   ', null, 123, ['CSE'], {}]) {
  test(`profile cannot save an empty or non-text branch: ${JSON.stringify(branch)}`, async () => {
    const errors = await errorsFor({ branch, passingYear: 2027 });
    assert.ok(errors.some(error => error.path === 'branch'));
  });
}

test('profile accepts education after signup and still permits unrelated partial updates', async () => {
  assert.deepEqual(await errorsFor({ branch: ' CSE ', passingYear: 2027 }), []);
  assert.deepEqual(await errorsFor({ name: 'Student' }), []);
});

for (const passingYear of ['', null, 0, 1999, 2101, 2027.5]) {
  test(`profile rejects an invalid graduation year: ${JSON.stringify(passingYear)}`, async () => {
    assert.ok((await errorsFor({ passingYear })).some(error => error.path === 'passingYear'));
  });
}

test('signup does not require education details', async () => {
  assert.deepEqual(await errorsFor({ name: 'Student', email: 'student@gmail.com' }, registerValidation), []);
});
