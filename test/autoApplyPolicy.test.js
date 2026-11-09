import assert from 'node:assert/strict';
import test from 'node:test';

const policy = await import('../src/services/autoApplyPolicy.js').catch(() => ({}));

test('automated submission accepts only supported public ATS job URLs', () => {
  assert.equal(typeof policy.supportedTarget, 'function', 'A strict provider boundary must exist');
  assert.equal(policy.supportedTarget('https://jobs.lever.co/example/12345678-1234-1234-1234-123456789abc').provider, 'lever');
  assert.equal(policy.supportedTarget('https://job-boards.greenhouse.io/example/jobs/1234567').provider, 'greenhouse');
  for (const url of ['https://localhost/apply', 'https://jobs.lever.co.attacker.test/a/b', 'https://user:pass@jobs.lever.co/a/b', 'http://jobs.lever.co/a/b', 'https://jobs.lever.co:444/a/b', 'https://jobs.lever.co/a', 'https://jobs.lever.co/a/b?redirect=https://localhost']) {
    assert.equal(policy.supportedTarget(url), null, url);
  }
});

test('submission requires new positive evidence and refuses contradictory success text', () => {
  assert.equal(typeof policy.submissionOutcome, 'function');
  assert.equal(policy.submissionOutcome('Your application has been submitted.', '').status, 'applied');
  assert.equal(policy.submissionOutcome('Application submitted', 'Application submitted').status, 'unconfirmed');
  assert.equal(policy.submissionOutcome('Thank you for applying. There was an error submitting your application.', '').status, 'blocked');
  assert.equal(policy.submissionOutcome('Please complete the required fields.', '').status, 'blocked');
  assert.equal(policy.submissionOutcome('We are processing your application.', '').status, 'unconfirmed');
});

test('old refusal/help text cannot classify a pending submission as safe to retry', () => {
  const before = 'Application form. If the connection drops, please try again.';
  assert.equal(policy.submissionOutcome(before, before).status, 'unconfirmed');
});
