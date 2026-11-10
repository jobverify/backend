import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPublicSuffixRules } from '../src/jobVerification/publicSuffix.js';
loadPublicSuffixRules('// ===BEGIN ICANN DOMAINS===\ncom\nuk\nco.uk\nnet\n*.ck\n!www.ck\n// ===BEGIN PRIVATE DOMAINS===\ngithub.io\n');

const { normalizeJobUrl, redactUrl, registrableDomain, atsIdentity, verificationKeys, isPublicAddress } = await import('../src/jobVerification/urls.js');

test('verification URL helpers are available', () => assert.equal(typeof normalizeJobUrl, 'function'));

test('normalization removes marketing parameters without losing vacancy identity', () => {
  assert.equal(normalizeJobUrl('https://EXAMPLE.com:443/jobs/42/?utm_source=mail&gh_jid=42#apply'), 'https://example.com/jobs/42?gh_jid=42');
  assert.notEqual(normalizeJobUrl('https://example.com/jobs?id=42'), normalizeJobUrl('https://example.com/jobs?id=43'));
  for (const url of ['file:///etc/passwd', 'https://user:secret@example.com/job', 'https://example.com:8443/job', 'https://example.com/job?access_token=secret']) {
    assert.throws(() => normalizeJobUrl(url), { status: 400 });
  }
});

test('domain identity uses public and private suffixes instead of matching brand words', () => {
  assert.equal(registrableDomain('https://jobs.acme.co.uk/path'), 'acme.co.uk');
  assert.equal(registrableDomain('https://fraud.co.uk'), 'fraud.co.uk');
  assert.equal(registrableDomain('https://victim.github.io/jobs'), 'victim.github.io');
  assert.notEqual(registrableDomain('https://acme.com'), registrableDomain('https://acme.net'));
  assert.equal(registrableDomain('https://jobs.www.ck'), 'www.ck');
  assert.equal(registrableDomain('https://jobs.acme.other.ck'), 'acme.other.ck');
  assert.equal(registrableDomain('https://acme.unknown-suffix'), null);
});

test('ATS identities preserve tenant, region and requisition across application paths', () => {
  assert.deepEqual(atsIdentity('https://job-boards.greenhouse.io/acme/jobs/123'), { provider: 'greenhouse', tenant: 'acme', roleId: '123', region: 'global' });
  assert.deepEqual(atsIdentity('https://jobs.eu.lever.co/acme/abc-def/apply'), { provider: 'lever', tenant: 'acme', roleId: 'abc-def', region: 'eu' });
  assert.equal(atsIdentity('https://jobs.lever.co.evil.com/acme/123'), null);
  assert.ok(verificationKeys({ sourceUrl: 'https://boards.greenhouse.io/acme/jobs/123' }).includes('role:greenhouse:global:acme:123'));
  assert.ok(!verificationKeys({ sourceUrl: 'https://boards.greenhouse.io/fraud/jobs/123' }).includes('role:greenhouse:global:acme:123'));
});

test('private, reserved, mapped and transition addresses are not fetch destinations', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '100.64.0.1', '0.0.0.0', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2002:7f00:1::', '64:ff9b::7f00:1']) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress('93.184.216.34'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('evidence URL redaction does not disclose contact or signed-link credentials', () => {
  const url = redactUrl('https://example.com/jobs/1?email=person%40example.com&token=secret&jobId=1#private');
  assert.ok(!url.includes('person') && !url.includes('secret') && !url.includes('private'));
  assert.ok(url.includes('jobId=1'));
});

test('API keys and common signed-session parameters are rejected and removed from evidence URLs', () => {
  for (const key of ['api_key', 'apikey', 'key', 'code', 'jwt', 'sid', 'hmac', 'credential', 'SAMLResponse', 'x-goog-credential']) {
    const url = `https://example.com/jobs/1?jobId=1&${key}=private-value`;
    assert.throws(() => normalizeJobUrl(url), { status: 400 }, key);
    assert.equal(redactUrl(url), 'https://example.com/jobs/1?jobId=1', key);
  }
});
