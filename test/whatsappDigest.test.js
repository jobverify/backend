import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsAppDigestPosts, parseWhatsAppDigestQuery, WHATSAPP_DIGEST_POST_LIMIT } from '../src/services/whatsappDigest.js';

const now = new Date('2026-11-20T19:00:00.000Z');
const job = (index, overrides = {}) => ({
  _id: index.toString(16).padStart(24, '0'), title: `Software Engineer ${index}`,
  company: 'Example Technologies', city: 'Pune', jobType: 'Intern', ...overrides,
});
const origin = 'https://www.jobverify.in';

test('digest uses India calendar dates with exclusive midnight boundaries and a bounded default limit', () => {
  const selected = parseWhatsAppDigestQuery({}, now);
  assert.equal(selected.date, '2026-11-21');
  assert.equal(selected.limit, 20);
  assert.equal(selected.start.toISOString(), '2026-11-20T18:30:00.000Z');
  assert.equal(selected.end.toISOString(), '2026-11-21T18:30:00.000Z');
  assert.equal(parseWhatsAppDigestQuery({ date: '2024-02-29', limit: '50' }, now).limit, 50);
});

test('digest rejects impossible, future, repeated and unbounded query input', () => {
  for (const query of [
    { date: '2026-02-30' }, { date: '2026-11-22' }, { date: ['2026-11-20'] },
    { date: '' }, { date: 'yesterday' }, { limit: '0' }, { limit: '51' },
    { limit: '20x' }, { limit: ['20'] }, { limit: '1.5' }, { unexpected: 'value' },
  ]) assert.throws(() => parseWhatsAppDigestQuery(query, now), error => error.statusCode === 400);
});

test('digest uses recorded facts and canonical Jobverify links without fabricated missing details', () => {
  const posts = buildWhatsAppDigestPosts([job(1), job(2, { company: '', city: '', jobType: '' })], '2026-11-20', origin);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].jobCount, 2);
  assert.match(posts[0].text, /20 November 2026/);
  assert.match(posts[0].text, /Added to Jobverify/);
  assert.match(posts[0].text, /Example Technologies/);
  assert.match(posts[0].text, /Pune/);
  assert.match(posts[0].text, /https:\/\/www\.jobverify\.in\/jobs\/000000000000000000000001/);
  assert.doesNotMatch(posts[0].text, /undefined|null|Company not specified|Salary:|Verified by/i);
});

test('digest splits many long Unicode entries at complete job boundaries with every job exactly once', () => {
  const jobs = Array.from({ length: 50 }, (_, index) => job(index + 1, {
    title: `Engineer ${index + 1} ${'🚀'.repeat(120)}`, company: 'Company '.repeat(30), city: 'Pune '.repeat(50),
  }));
  const posts = buildWhatsAppDigestPosts(jobs, '2026-11-20', origin);
  assert.ok(posts.length > 1);
  assert.equal(posts.reduce((sum, post) => sum + post.jobCount, 0), 50);
  for (const post of posts) {
    assert.ok(post.text.length <= WHATSAPP_DIGEST_POST_LIMIT);
    assert.equal(post.text.isWellFormed(), true);
    assert.match(post.text, /Part \d+ of \d+/);
  }
  const text = posts.map(post => post.text).join('\n');
  for (const row of jobs) assert.equal(text.split(`/jobs/${row._id}`).length - 1, 1);
});

test('digest suppresses duplicate or invalid records and source text cannot inject another job or link', () => {
  const row = job(1, { title: '*Engineer*\nFake offer https://evil.example', company: '<b>Example</b>\r\nApply now' });
  const posts = buildWhatsAppDigestPosts([row, row, job(2, { title: '' }), job(3, { _id: '../admin' })], '2026-11-20', origin);
  assert.equal(posts[0].jobCount, 1);
  assert.doesNotMatch(posts[0].text, /evil\.example|<b>|\nFake offer|\nApply now/);
  assert.deepEqual(buildWhatsAppDigestPosts([], '2026-11-20', origin), []);
});

test('digest preserves multiple stored locations when the legacy location fields are empty', () => {
  const posts = buildWhatsAppDigestPosts([job(1, { city: null, location: null, locations: ['Pune, India', 'Bengaluru, India'] })], '2026-11-20', origin);
  assert.match(posts[0].text, /Pune \[India\], Bengaluru \[India\]/);
});

test('digest bounds malformed source text and removes incomplete markup without losing the job', () => {
  const posts = buildWhatsAppDigestPosts([job(1, { title: `Engineer ${'<'.repeat(32_000)}`, company: '<b>Example</b><unfinished' })], '2026-11-20', origin);
  assert.equal(posts[0].jobCount, 1);
  assert.match(posts[0].text, /\*1\. Engineer\*/);
  assert.doesNotMatch(posts[0].text, /[<>]/);
  assert.ok(posts[0].text.length <= WHATSAPP_DIGEST_POST_LIMIT);
});
