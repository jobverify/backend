import assert from 'node:assert/strict';
import test from 'node:test';
import { investigateJob } from '../src/jobVerification/engine.js';
import { loadPublicSuffixRules } from '../src/jobVerification/publicSuffix.js';

loadPublicSuffixRules('// ===BEGIN ICANN DOMAINS===\ncom\nco\nio\n// ===BEGIN PRIVATE DOMAINS===\ngithub.io\n');
const url = 'https://jobs.lever.co/acme/new-role';
const api = 'https://api.lever.co/v0/postings/acme/new-role';
const career = 'https://www.acme.com/careers';
const page = '<h1>Engineer</h1><p>Build reliable software with our product team. Work with designers and engineers on customer services.</p>';
const now = () => new Date('2026-11-11T10:00:00Z');
const response = (address, body, status = 200) => ({ url: address, status, body, observedAt: now().toISOString() });
const record = { company: 'Acme', companyDomain: 'acme.com', companyCareerPage: career, sourceUrl: url, jobId: 'new-role', title: 'Engineer' };

function dependencies({ records = [], pages = {}, risk = [] } = {}) {
  return { now, findCandidates: async () => records, checkRisk: async () => risk, fetchPage: async address => {
    const value = pages[address] ?? (address === url ? page : address === career ? `<h1>Acme careers</h1><a href="https://jobs.lever.co/acme">Open jobs</a>` : null);
    if (value == null) throw new Error('Fixture source unavailable');
    return typeof value === 'string' ? response(address, value) : value;
  } };
}

test('a published ATS role can be checked without treating an unknown employer as confirmed', async () => {
  const report = await investigateJob({ url }, dependencies({ pages: { [api]: JSON.stringify({ id: 'new-role', text: 'Engineer', hostedUrl: url }) } }));
  assert.equal(report.verdict, 'inconclusive');
  assert.equal(report.sourceStatus, 'unconfirmed');
  assert.equal(report.availability, 'open');
  const vacancy = report.evidence.find(item => item.id === 'vacancy');
  assert.equal(vacancy.status, 'completed');
  assert.equal(vacancy.outcome, 'neutral');
  assert.equal(vacancy.sourceUrl, api);
  assert.match(vacancy.detail, /new-role/);
  assert.match(vacancy.detail, /employer.*unconfirmed/i);
});

test('a non-existent ATS ID is not called a closed or fraudulent vacancy without historical proof', async () => {
  const report = await investigateJob({ url }, dependencies({ pages: { [api]: response(api, 'Not found', 404) } }));
  assert.equal(report.verdict, 'inconclusive');
  assert.equal(report.availability, 'unknown');
  assert.match(report.evidence.find(item => item.id === 'vacancy').detail, /not published|not found/i);
});

test('a missing ATS role redirected to a directory cannot be replaced with a different live role', async () => {
  const missing = 'https://jobs.lever.co/acme/missing-role';
  const missingApi = 'https://api.lever.co/v0/postings/acme/missing-role';
  const report = await investigateJob({ url: missing }, dependencies({ records: [record], pages: {
    [missing]: { ...response('https://jobs.lever.co/acme', `<h1>Jobs at Acme</h1><a href="${url}">Engineer</a>`), redirects: [{ from: missing, to: 'https://jobs.lever.co/acme', status: 302 }] },
    [missingApi]: response(missingApi, 'Not found', 404),
    [api]: JSON.stringify({ id: 'new-role', text: 'Engineer', hostedUrl: url }),
  } }));
  assert.notEqual(report.verdict, 'official');
  assert.notEqual(report.verdict, 'matching');
  assert.equal(report.officialUrl, null);
  assert.equal(report.availability, 'unknown');
  assert.equal(report.evidence.find(item => item.id === 'vacancy').sourceUrl, missingApi);
  assert.equal(report.title, '');
});

test('a provider response for another role cannot establish publication', async () => {
  const report = await investigateJob({ url }, dependencies({ pages: { [api]: JSON.stringify({ id: 'different-role', text: 'Engineer', hostedUrl: url }) } }));
  assert.equal(report.verdict, 'inconclusive');
  assert.equal(report.availability, 'unknown');
  assert.match(report.evidence.find(item => item.id === 'vacancy').detail, /identifier.*match/i);
});

test('a specific suspicious request is explained with its excerpt and stays a caution signal', async () => {
  const report = await investigateJob({ url }, dependencies({ pages: { [url]: `${page}<p>Deposit the check and send back the difference before starting work.</p>` } }));
  assert.equal(report.verdict, 'caution');
  const finding = report.evidence.find(item => item.id === 'scam_patterns');
  assert.match(finding.detail, /cheque|check|overpayment/i);
  assert.match(finding.excerpt, /send back the difference/i);
  assert.ok(report.reasons.some(reason => reason.evidenceId === finding.id));
  assert.ok(report.reasons.every(reason => report.evidence.some(item => item.id === reason.evidenceId)));
});

test('an accessible ATS description is checked when the HTML posting is blocked', async () => {
  const description = 'Pay the application fee before starting the job.';
  const report = await investigateJob({ url }, dependencies({ pages: {
    [url]: response(url, '<h1>Access denied</h1>', 403),
    [api]: JSON.stringify({ id: 'new-role', text: 'Engineer', hostedUrl: url, descriptionPlain: description }),
  } }));
  assert.equal(report.availability, 'open');
  assert.equal(report.verdict, 'caution');
  const finding = report.evidence.find(item => item.id === 'scam_patterns');
  assert.equal(finding.sourceUrl, api);
  assert.match(finding.excerpt, /application fee/i);
});

test('a clean official API description cannot erase suspicious requests on the submitted page', async () => {
  const report = await investigateJob({ url }, dependencies({ records: [record], pages: {
    [url]: `${page}<p>Deposit the check and send back the difference to start work.</p>`,
    [api]: JSON.stringify({ id: 'new-role', text: 'Engineer', hostedUrl: url, descriptionPlain: 'Build customer services with our engineers.' }),
  } }));
  assert.equal(report.verdict, 'official');
  assert.equal(report.risk, 'caution');
  assert.equal(report.evidence.find(item => item.id === 'scam_patterns').sourceUrl, url);
});

test('readable suspicious requests on an HTTP error page are retained as observations', async () => {
  const report = await investigateJob({ url }, dependencies({ pages: {
    [url]: response(url, '<h1>Application required</h1><p>Pay the application fee before starting the job.</p>', 403),
    [api]: JSON.stringify({ id: 'new-role', text: 'Engineer', hostedUrl: url, descriptionPlain: 'Build customer services with our engineers.' }),
  } }));
  assert.equal(report.verdict, 'caution');
  assert.equal(report.evidence.find(item => item.id === 'scam_patterns').sourceUrl, url);
  assert.match(report.evidence.find(item => item.id === 'scam_patterns').excerpt, /application fee/);
});

for (const [destination, expected] of [
  ['https://www.acme.com/careers/engineer/123?gh_jid=123', 'official'],
  ['https://www.acme.com/careers/engineer/999?gh_jid=999', 'inconclusive'],
  ['https://unrelated.com/careers/engineer/123?gh_jid=123', 'inconclusive'],
]) test(`a first-party canonical redirect preserves only the exact recorded vacancy: ${destination}`, async () => {
  const submitted = 'https://www.acme.com/jobs?gh_jid=123';
  const known = { ...record, sourceUrl: submitted, jobId: '123', title: 'Engineer' };
  const report = await investigateJob({ url: submitted }, dependencies({ records: [known], pages: {
    [submitted]: { ...response(destination, page), redirects: [{ from: submitted, to: destination, status: 301 }] },
  } }));
  assert.equal(report.verdict, expected);
  if (expected === 'official') {
    assert.equal(report.officialUrl, destination);
    assert.equal(report.evidence.find(item => item.id === 'vacancy').sourceUrl, destination);
    assert.match(report.evidence.find(item => item.id === 'vacancy').excerpt, /123/);
  } else assert.equal(report.officialUrl, null);
});

test('a submitted slash-significant official URL is fetched as submitted and is not falsely closed', async () => {
  const submitted = 'https://www.acme.com/jobs/123/';
  const known = { ...record, sourceUrl: submitted, jobId: '123', title: 'Engineer' };
  const report = await investigateJob({ url: submitted }, dependencies({ records: [known], pages: {
    [submitted]: page,
    [submitted.slice(0, -1)]: response(submitted.slice(0, -1), 'Not found', 404),
  } }));
  assert.equal(report.availability, 'open');
  assert.equal(report.verdict, 'official');
  assert.equal(report.evidence.find(item => item.id === 'vacancy').sourceUrl, submitted);
});

test('an ATS API record cannot confer official-publisher trust on an unrelated final destination', async () => {
  const foreign = 'https://unrelated.com/ad/999';
  const report = await investigateJob({ url }, dependencies({ records: [record], pages: {
    [url]: { ...response(foreign, '<h1>Another publisher</h1><p>Unverified recruiting material on another website.</p>'), redirects: [{ from: url, to: foreign, status: 302 }] },
    [api]: JSON.stringify({ id: 'new-role', text: 'Engineer', hostedUrl: url }),
  } }));
  assert.equal(report.sourceStatus, 'unconfirmed');
  assert.equal(report.verdict, 'caution');
  assert.equal(report.availability, 'open');
  assert.equal(report.officialUrl, null);
  assert.ok(report.evidence.some(item => item.id === 'publisher_redirect' && item.sourceUrl === foreign && item.outcome === 'caution'));
});

for (const exactFirst of [true, false]) test(`the exact historical ATS record takes priority over another tenant role (exact first: ${exactFirst})`, async () => {
  const other = { ...record, sourceUrl: 'https://jobs.lever.co/acme/other-role', jobId: 'other-role' };
  const report = await investigateJob({ url }, dependencies({ records: exactFirst ? [record, other] : [other, record], pages: { [api]: response(api, 'Not found', 404) } }));
  assert.equal(report.availability, 'closed');
  assert.equal(report.verdict, 'official');
});

test('a canonical URL identifier cannot contradict the matched structured vacancy identifier', async () => {
  const submitted = 'https://www.acme.com/jobs?gh_jid=123';
  const destination = 'https://www.acme.com/careers/another-role/999?gh_jid=999';
  const body = `<h1>Marketing Manager</h1><script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: 'Marketing Manager', identifier: { value: '123' } })}</script><p>Lead our marketing team and help our customers discover the products that meet their needs.</p>`;
  const report = await investigateJob({ url: submitted }, dependencies({ records: [{ ...record, sourceUrl: submitted, jobId: '123', title: 'Engineer' }], pages: {
    [submitted]: { ...response(destination, body), redirects: [{ from: submitted, to: destination, status: 301 }] },
  } }));
  assert.equal(report.verdict, 'inconclusive');
  assert.equal(report.officialUrl, null);
  assert.ok(!report.evidence.some(item => /Matched vacancy ID: 999/.test(item.excerpt || '')));
});

test('discovered employer careers links retain their slash-significant request path', async () => {
  const home = 'https://www.acme.com/';
  const careers = 'https://www.acme.com/careers/';
  const report = await investigateJob({ url }, dependencies({ records: [{ ...record, companyCareerPage: home }], pages: {
    [home]: `<h1>Acme</h1><a href="${careers}">Careers</a>`,
    [careers]: '<h1>Acme careers</h1><a href="https://jobs.lever.co/acme">Open positions</a>',
    [careers.slice(0, -1)]: response(careers.slice(0, -1), 'Not found', 404),
    [api]: JSON.stringify({ id: 'new-role', text: 'Engineer', hostedUrl: url }),
  } }));
  assert.equal(report.verdict, 'official');
  assert.equal(report.evidence.find(item => item.id === 'employer').sourceUrl, careers);
});
