import assert from 'node:assert/strict';
import test from 'node:test';
import { readJobPage, suspiciousRequests } from '../src/jobVerification/content.js';

test('a generic accessibility heading does not hide the actual vacancy title', () => {
  const page = readJobPage('<title>Frontend Engineer - Acme Careers</title><h1>job details</h1><h2>Frontend Engineer</h2><p>Build accessible customer services.</p>', 'https://www.acme.com/jobs/123');
  assert.equal(page.title, 'Frontend Engineer - Acme Careers');
});

for (const text of [
  'Pay the application fee before starting the job.',
  'Deposit the cheque, then send back the difference to our vendor.',
  'Recharge your account with USDT to unlock tasks and withdraw your earnings.',
  'Purchase gift cards and send us the codes to activate your employment.',
  'You must transfer USDT before the interview to secure this job.',
  'Send Bitcoin to our wallet before we issue your employment offer.',
  'We interview candidates on WhatsApp.',
  'Our company will contact applicants through Telegram.',
]) test(`a concrete scam request has an explanation and excerpt: ${text}`, () => {
  const findings = suspiciousRequests(text);
  assert.ok(findings.length > 0);
  assert.ok(findings.every(item => item.title && item.detail && item.excerpt));
});

for (const text of [
  'Sales role with salary plus commission. We reimburse approved travel expenses.',
  'Build blockchain infrastructure. Experience with Bitcoin and crypto protocols is required.',
  'DASH Brands will never ask you to pay money or share sensitive financial information during hiring.',
  'Beware of scams that ask you to deposit the check and send back the difference.',
  'We do not ask applicants to pay a registration fee. Contact our team on our careers site.',
  'As a bank teller, you will deposit each check and transfer the funds to customer accounts.',
  'We pay your salary in crypto every month.',
  'We will pay your training fee after onboarding.',
  'We pay the background-check fee for all applicants.',
  'The interview will not be on WhatsApp.',
]) test(`ordinary work and fraud warnings are not applicant scam requests: ${text}`, () => {
  assert.deepEqual(suspiciousRequests(text), []);
});

test('a warning earlier in the posting cannot hide a later payment request', () => {
  const findings = suspiciousRequests('We never charge a registration fee. Pay the registration fee to activate your account.');
  assert.ok(findings.some(item => /payment|fee/i.test(item.title)));
});

for (const text of [
  'Previous experience is not required; pay the application fee before starting work.',
  'We do not send cash. Pay the application fee to start work.',
  'You must deposit the check; do not keep the excess, send back the difference.',
]) test(`irrelevant negation does not hide an applicant payment demand: ${text}`, () => {
  assert.ok(suspiciousRequests(text).length > 0);
});
