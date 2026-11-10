import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPublicSuffixRules } from '../src/jobVerification/publicSuffix.js';
loadPublicSuffixRules('// ===BEGIN ICANN DOMAINS===\ncom\nuk\nco.uk\nnet\nco\nio\n// ===BEGIN PRIVATE DOMAINS===\ngithub.io\n');
const { investigateJob } = await import('../src/jobVerification/engine.js').catch(() => ({}));

const now = () => new Date('2026-11-10T10:00:00Z');
const official = 'https://careers.acme.co.uk/jobs/123';
const career = 'https://www.acme.co.uk/careers';
const job = { _id: '507f1f77bcf86cd799439011', company: 'Acme', companyDomain: 'acme.co.uk', companyCareerPage: career,
  sourceUrl: official, requisitionId: '123', jobId: '123', title: 'Frontend Engineer', status: 'active', lastSeenAt: now() };
const posting = (id = '123', company = 'Acme', extra = '') => `<html><title>Frontend Engineer</title><script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: 'Frontend Engineer', identifier: { value: id }, hiringOrganization: { name: company } })}</script><h1>Frontend Engineer</h1><p>Build accessible web applications with our product team. Collaborate with engineers on customer-facing services.</p>${extra}</html>`;
const response = (url, body, status = 200) => ({ url, body, status, headers: { 'content-type': 'text/html' }, redirects: [], observedAt: now().toISOString() });
const unavailableRisk = async () => [{ id: 'phishing', phase: 'risk', title: 'Phishing reputation', status: 'unavailable', outcome: 'neutral', detail: 'The source is unavailable; safety could not be assessed.', sourceUrl: 'https://github.com/Phishing-Database/Phishing.Database', observedAt: now().toISOString() }];

function dependencies({ records = [job], pages = {}, risk = unavailableRisk } = {}) {
  const map = { [official]: posting(), [career]: '<h1>Acme careers</h1><a href="https://careers.acme.co.uk/jobs/123">Frontend Engineer</a>', ...pages };
  return { now, findCandidates: async () => records, checkRisk: risk, fetchPage: async (url) => {
    if (!(url in map)) throw Object.assign(new Error('unavailable fixture'), { code: 'source_unavailable' });
    return typeof map[url] === 'string' ? response(url, map[url]) : map[url];
  } };
}

test('an exact live official role is confirmed with employer and vacancy proofs', async () => {
  const progress = [];
  const result = await investigateJob({ url: official }, { ...dependencies(), onProgress: async value => progress.push(structuredClone(value)) });
  assert.equal(result.verdict, 'official');
  assert.equal(result.availability, 'open');
  assert.equal(result.officialUrl, official);
  assert.ok(result.evidence.some(item => item.id === 'employer' && item.outcome === 'supporting'));
  assert.ok(result.evidence.some(item => item.id === 'vacancy' && item.outcome === 'supporting'));
  assert.ok(result.evidence.some(item => item.id === 'phishing' && item.status === 'unavailable'));
  assert.ok(progress.length >= 4);
  for (const item of result.evidence) { assert.ok(item.sourceUrl); assert.ok(item.observedAt); assert.ok(item.detail); }
  assert.equal(result.reasons.length, 3);
});

test('a third-party repost links to a real role without confirming the repost publisher', async () => {
  const url = 'https://jobsboard.example.com/ad/456';
  const result = await investigateJob({ url }, dependencies({ pages: { [url]: posting('123', 'Acme', `<a href="${official}">Original vacancy</a>`) } }));
  assert.equal(result.verdict, 'matching');
  assert.equal(result.sourceStatus, 'third_party');
  assert.equal(result.officialUrl, official);
});

test('a duplicate title without an identifier or official link remains inconclusive', async () => {
  const url = 'https://jobsboard.example.com/ad/456';
  const result = await investigateJob({ url, company: 'Acme', title: 'Frontend Engineer' }, dependencies({ pages: { [url]: '<h1>Frontend Engineer at Acme</h1><p>A position with our growing team.</p>' } }));
  assert.equal(result.verdict, 'inconclusive');
  assert.equal(result.officialUrl, null);
});

test('a known official role that is no longer published is closed rather than high risk', async () => {
  const result = await investigateJob({ url: official }, dependencies({ pages: { [official]: response(official, 'Not found', 404) } }));
  assert.equal(result.availability, 'closed');
  assert.notEqual(result.verdict, 'high_risk');
});

test('a blocked page with no evidence remains inconclusive rather than safe', async () => {
  const url = 'https://www.linkedin.com/jobs/view/123';
  const result = await investigateJob({ url }, dependencies({ records: [], pages: { [url]: response(url, 'Log in to continue', 403) } }));
  assert.equal(result.verdict, 'inconclusive');
  assert.equal(result.availability, 'unknown');
  assert.equal(result.officialUrl, null);
});

test('a lookalike company domain cannot inherit official-company confirmation', async () => {
  const url = 'https://acme-careers.co.uk/jobs/123';
  const result = await investigateJob({ url }, dependencies({ pages: { [url]: posting() } }));
  assert.notEqual(result.verdict, 'official');
  assert.equal(result.sourceStatus, 'third_party');
  assert.equal(result.risk, 'caution');
});

test('an ATS role needs an employer-to-tenant link before it can be confirmed', async () => {
  const url = 'https://jobs.lever.co/acme/abc-def';
  const api = 'https://api.lever.co/v0/postings/acme/abc-def';
  const record = { ...job, sourceUrl: url, jobId: 'abc-def', requisitionId: 'abc-def' };
  const pages = { [url]: posting('abc-def'), [api]: response(api, JSON.stringify({ id: 'abc-def', text: 'Frontend Engineer', hostedUrl: url, descriptionPlain: 'Build accessible software with our engineering team.' })) };
  const unbound = await investigateJob({ url }, dependencies({ records: [record], pages }));
  assert.notEqual(unbound.verdict, 'official');
  const bound = await investigateJob({ url }, dependencies({ records: [record], pages: { ...pages, [career]: `<h1>Careers at Acme</h1><a href="${url}">Open jobs</a>` } }));
  assert.equal(bound.verdict, 'official');
  assert.equal(bound.availability, 'open');
});

test('a fresh threat-feed hit takes priority over other supporting checks', async () => {
  const risk = async () => [{ id: 'phishing', phase: 'risk', title: 'Phishing reputation', status: 'completed', outcome: 'threat', detail: 'The exact host appears in the current phishing feed.', sourceUrl: 'https://github.com/Phishing-Database/Phishing.Database', observedAt: now().toISOString() }];
  const result = await investigateJob({ url: official }, dependencies({ risk }));
  assert.equal(result.verdict, 'high_risk');
});

test('ordinary commission and reimbursement wording does not become a definitive scam claim', async () => {
  const url = 'https://smallbusiness.example.com/jobs/1';
  const result = await investigateJob({ url }, dependencies({ records: [], pages: { [url]: '<h1>Sales role</h1><p>Salary plus commission. We reimburse approved business travel expenses.</p>' } }));
  assert.equal(result.verdict, 'inconclusive');
  assert.ok(!result.evidence.some(item => item.outcome === 'threat'));
});

test('an interrupted investigation retains completed evidence and marks remaining checks unavailable', async () => {
  const controller = new AbortController();
  const deps = dependencies();
  const result = await investigateJob({ url: official }, { ...deps, signal: controller.signal, onProgress: async report => {
    if (report.phase === 'employer') controller.abort();
  } });
  assert.equal(result.verdict, 'inconclusive');
  assert.ok(result.evidence.some(item => item.id === 'destination' && item.status === 'completed'));
  assert.ok(result.evidence.some(item => item.status === 'unavailable'));
});

test('a generic careers directory cannot be confirmed as one vacancy', async () => {
  const result = await investigateJob({ url: official }, dependencies({ records: [{ ...job, applicationUrlIsGeneric: true }] }));
  assert.equal(result.verdict, 'inconclusive');
});

test('a published expiration date is preserved in the evidence for a closed role', async () => {
  const html = posting().replace('"identifier":', '"validThrough":"2020-01-01T00:00:00Z","identifier":');
  const result = await investigateJob({ url: official }, dependencies({ pages: { [official]: html } }));
  assert.equal(result.availability, 'closed');
  assert.match(result.evidence.find(item => item.id === 'vacancy').detail, /2020-01-01/);
});

test('submitted and intermediate redirect hosts retain threat findings even when the final vacancy is official', async () => {
  const url = 'https://short.example.com/job';
  const intermediate = 'https://listed-phishing.com/go';
  const checked = [];
  const redirected = { ...response(official, posting()), redirects: [{ from: url, to: intermediate, status: 302 }, { from: intermediate, to: official, status: 302 }] };
  const risk = async target => {
    checked.push(new URL(target).hostname);
    return [{ id: 'phishing', title: 'Phishing reputation', status: 'completed', outcome: target === intermediate ? 'threat' : 'neutral', detail: 'Feed observation for this host.', sourceUrl: 'https://example.com/feed', observedAt: now().toISOString() }];
  };
  const result = await investigateJob({ url }, dependencies({ pages: { [url]: redirected }, risk }));
  assert.deepEqual(new Set(checked), new Set(['short.example.com', 'listed-phishing.com', 'careers.acme.co.uk']));
  assert.equal(result.verdict, 'high_risk');
  assert.ok(result.evidence.some(item => item.outcome === 'threat' && `${item.detail} ${item.excerpt}`.includes('listed-phishing.com')));
});

for (const [url, api, roleId, board] of [
  ['https://jobs.lever.co/acme/abc-def', 'https://api.lever.co/v0/postings/acme/abc-def', 'abc-def', 'https://jobs.lever.co/acme'],
  ['https://boards.greenhouse.io/acme/jobs/123', 'https://boards-api.greenhouse.io/v1/boards/acme/jobs/123', '123', 'https://boards.greenhouse.io/acme'],
]) {
  test(`an employer link to the ${new URL(board).hostname} board root establishes tenant ownership`, async () => {
    const record = { ...job, sourceUrl: url, jobId: roleId, requisitionId: roleId };
    const result = await investigateJob({ url }, dependencies({ records: [record], pages: {
      [url]: posting(roleId), [api]: response(api, JSON.stringify({ id: roleId, title: job.title })),
      [career]: `<h1>Acme careers</h1><a href="${board}">Our vacancies</a>`,
    } }));
    assert.equal(result.verdict, 'official');
    assert.match(result.evidence.find(item => item.id === 'employer').excerpt, /acme/);
  });

  for (const status of [200, 404]) test(`a redirected ${new URL(api).hostname} API response (${status}) cannot establish a vacancy`, async () => {
    const record = { ...job, sourceUrl: url, jobId: roleId, requisitionId: roleId };
    const result = await investigateJob({ url }, dependencies({ records: [record], pages: {
      [url]: posting(roleId), [api]: response('https://unrelated.com/fake-api', JSON.stringify({ id: roleId, title: job.title }), status),
      [career]: `<h1>Acme careers</h1><a href="${url}">Our vacancies</a>`,
    } }));
    assert.equal(result.verdict, 'inconclusive');
    assert.equal(result.availability, 'unknown');
    assert.equal(result.evidence.find(item => item.id === 'vacancy').outcome, 'neutral');
  });
}

test('expired or unavailable domain identity data cannot reuse a previously loaded suffix list for confirmation', async () => {
  const result = await investigateJob({ url: official }, { ...dependencies(), prepareSources: async () => { throw new Error('Refresh failed'); } });
  assert.equal(result.verdict, 'inconclusive');
  assert.ok(result.evidence.some(item => item.id === 'suffix' && item.status === 'unavailable'));
});

test('an HTTP-only employer and vacancy cannot provide authenticated official-source proof', async () => {
  const url = official.replace('https:', 'http:');
  const employer = career.replace('https:', 'http:');
  const result = await investigateJob({ url }, dependencies({ records: [{ ...job, sourceUrl: url, companyCareerPage: employer }], pages: {
    [url]: posting(), [employer]: `<h1>Acme careers</h1><a href="${url}">Frontend Engineer</a>`,
  } }));
  assert.notEqual(result.verdict, 'official');
  assert.equal(result.risk, 'caution');
});

test('an exact URL and title cannot override an explicitly conflicting vacancy identifier', async () => {
  const result = await investigateJob({ url: official }, dependencies({ pages: { [official]: posting('different-role') } }));
  assert.equal(result.verdict, 'inconclusive');
});

test('a generic official URL redirecting to an unrelated 404 cannot establish closure', async () => {
  const result = await investigateJob({ url: official }, dependencies({ pages: { [official]: response('https://unrelated.com/gone', 'Not found', 404) } }));
  assert.equal(result.availability, 'unknown');
  assert.equal(result.verdict, 'inconclusive');
});
