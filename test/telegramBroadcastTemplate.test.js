import assert from 'node:assert/strict';
import test, { after } from 'node:test';

const previousOrigin = process.env.FRONTEND_ORIGIN;
process.env.FRONTEND_ORIGIN = 'https://www.jobverify.in';
after(() => {
  if (previousOrigin === undefined) delete process.env.FRONTEND_ORIGIN;
  else process.env.FRONTEND_ORIGIN = previousOrigin;
});
import { renderBroadcastTemplate, validateBroadcastTemplate, DEFAULT_BROADCAST_TEMPLATE, BROADCAST_SAMPLE_JOBS } from '../src/services/telegramBroadcastTemplate.js';

test('preview and delivery share the same template renderer and verified data', () => {
  const text = renderBroadcastTemplate(DEFAULT_BROADCAST_TEMPLATE, BROADCAST_SAMPLE_JOBS.complete);
  assert.ok(text.startsWith('📌 Example Company is hiring Software Engineer'));
  assert.ok(text.includes('🎓 Batch :- 2026'));
  assert.ok(text.includes('⚙️ Type :- Full time'));
  assert.ok(text.endsWith('https://t.me/jobverifygroup'));
  assert.doesNotMatch(text, /posted|today|yesterday|No experience required/i);
  assert.ok(text.length <= 4096);
});

test('lines with missing source details disappear instead of inventing metadata', () => {
  const template = '{company} is hiring {title}\nBatch {batch}\nExperience {experience}\nSalary {salary}\nWork mode {workMode}\n{jobUrl}';
  const text = renderBroadcastTemplate(template, BROADCAST_SAMPLE_JOBS.minimal);
  assert.doesNotMatch(text, /Batch|Experience|Salary|Work mode/);
  assert.ok(text.includes('https://www.jobverify.in/jobs/507f1f77bcf86cd799439011'));
});

test('unsupported tokens, code expressions and templates without an apply link are rejected', () => {
  for (const template of ['{title} {postedAt} {jobUrl}', '{title} {user.email} {jobUrl}', '{constructor} {jobUrl}', '{title}', '{{title}} {jobUrl}', '{jobUrl}\u0000']) {
    assert.throws(() => validateBroadcastTemplate(template));
  }
  assert.throws(() => validateBroadcastTemplate('{jobUrl}\n'.repeat(250)), /4096|long/);
});

test('source values cannot inject new placeholders or unexpected multiline metadata', () => {
  const text = renderBroadcastTemplate('{company}\n{title}\n{jobUrl}', { company: 'Example\nInjected', title: '{salary} <b>Role</b>', sourceUrl: 'https://example.test/job' });
  assert.ok(text.startsWith('Example Injected\n{salary} Role\n'));
  assert.doesNotMatch(text, /<b>/);
});

test('missing optional fields cannot remove the mandatory application link', () => {
  assert.equal(renderBroadcastTemplate('{salary} {jobUrl}', BROADCAST_SAMPLE_JOBS.minimal), 'https://www.jobverify.in/jobs/507f1f77bcf86cd799439011');
  const text = renderBroadcastTemplate('Role: {title}\nPay and apply: {salary} {jobUrl}', BROADCAST_SAMPLE_JOBS.minimal);
  assert.ok(text.includes('https://www.jobverify.in/jobs/507f1f77bcf86cd799439011'));
  assert.doesNotMatch(text, /Pay and apply/);
});
