import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPublicSuffixRules } from '../src/jobVerification/publicSuffix.js';
loadPublicSuffixRules('// ===BEGIN ICANN DOMAINS===\ncom\nuk\nco.uk\n// ===BEGIN PRIVATE DOMAINS===\ngithub.io\n');
const { createSourceChecks } = await import('../src/jobVerification/sources.js').catch(() => ({}));
const now = () => new Date('2026-11-10T10:00:00Z');
const cache = () => { const records = new Map(); return { get: async key => records.get(key), put: async (key, value) => records.set(key, value) }; };

test('a failed phishing download with no cache is unavailable, never a clean result', async () => {
  const sources = createSourceChecks({ cache: cache(), now, fetchPage: async () => { throw new Error('network unavailable'); } });
  const results = await sources.checkRisk('https://example.com/jobs/1');
  assert.equal(results.find(item => item.id === 'phishing').status, 'unavailable');
  assert.ok(!results.some(item => item.outcome === 'supporting'));
});

test('fresh phishing matches are threats and cached observations retain their original timestamp', async () => {
  let downloads = 0;
  const sources = createSourceChecks({ cache: cache(), now, fetchPage: async url => {
    downloads++;
    return { status: 200, body: url.includes('phishing-domains') ? 'bad.example.com\nanother-bad.example.com\n' : JSON.stringify({ events: [{ eventAction: 'registration', eventDate: '2010-01-01T00:00:00Z' }] }) };
  } });
  const first = await sources.checkRisk('https://bad.example.com/jobs/1');
  const second = await sources.checkRisk('https://bad.example.com/jobs/1');
  assert.equal(first.find(item => item.id === 'phishing').outcome, 'threat');
  assert.equal(second.find(item => item.id === 'phishing').observedAt, '2026-11-10T10:00:00.000Z');
  assert.equal(downloads, 2);
});

test('an invalid downloaded feed cannot replace a valid cached copy or imply a clean scan', async () => {
  const sources = createSourceChecks({ cache: cache(), now, fetchPage: async () => ({ status: 200, body: '<html>Rate limit</html>' }) });
  const results = await sources.checkRisk('https://example.com/jobs/1');
  assert.equal(results.find(item => item.id === 'phishing').status, 'unavailable');
});
