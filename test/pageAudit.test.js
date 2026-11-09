import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeSnapshot, auditPage, normalizeSnapshot } from '../src/seo/pageAudit.js';

const snapshot = () => ({
  url: 'https://example.com/jobs?token=private#account',
  title: 'Authentic jobs and internships in India',
  descriptions: ['Discover verified career opportunities from official company career pages. Browse jobs, internships and hiring companies across India.'],
  headings: [{ level: 1, text: 'Authentic jobs in India' }, { level: 2, text: 'Latest roles' }],
  canonicals: ['https://example.com/jobs'],
  robots: [{ name: 'robots', content: 'index,follow' }],
  openGraph: [{ property: 'og:title', content: 'Jobs' }, { property: 'og:description', content: 'Official company roles' }, { property: 'og:image', content: 'https://example.com/og.png' }],
});
const env = { ANTHROPIC_API_KEY: 'fixture-anthropic-secret', ANTHROPIC_MODEL: 'fixture-model' };
const recommendation = { category: 'metadata', priority: 'medium', issue: 'Clarify the audience', evidenceField: 'title', recommendation: 'Mention the relevant audience in the title.', rationale: 'A more specific title can describe the page better.', verification: 'Inspect the rendered title tag.' };

test('semantic snapshots strip URL secrets and unknown fields, and reject malformed collection types', () => {
  const clean = normalizeSnapshot({ ...snapshot(), cookies: 'secret', html: '<input value="secret">', excerpt: '' });
  assert.equal(clean.url, 'https://example.com/jobs');
  assert.equal(clean.cookies, undefined);
  assert.equal(clean.html, undefined);
  assert.throws(() => normalizeSnapshot({ ...snapshot(), headings: 'wrong' }), error => error.status === 400);
  assert.throws(() => normalizeSnapshot({ ...snapshot(), url: 'javascript:alert(1)' }), error => error.status === 400);
  assert.throws(() => normalizeSnapshot({ ...snapshot(), excerpt: 'x'.repeat(4001) }), error => error.status === 400);
});

test('scorecards use observed metadata and distinguish noindex, missing canonical, headings and social fields', () => {
  const healthy = analyzeSnapshot(snapshot());
  assert.equal(healthy.score, 100);
  assert.equal(healthy.scorecards.length, 5);
  const bad = analyzeSnapshot({ ...snapshot(), title: '', descriptions: [], canonicals: [], headings: [], openGraph: [], robots: [{ name: 'googlebot', content: 'NOINDEX, follow' }] });
  assert.equal(bad.scorecards.find(card => card.id === 'indexability').status, 'fail');
  assert.equal(bad.scorecards.find(card => card.id === 'metadata').status, 'fail');
  assert.ok(bad.score < healthy.score);
  assert.match(bad.scope, /index.*status.*not|not.*index.*status/i);
});

test('Claude receives bounded untrusted evidence and produces validated, evidence-linked actions', async () => {
  let sent;
  const result = await auditPage(snapshot(), { env, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(options.headers['x-api-key'], env.ANTHROPIC_API_KEY);
    sent = JSON.parse(options.body);
    return new Response(JSON.stringify({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'seo_recommendations', input: { summary: 'The page has clear metadata.', recommendations: [recommendation] } }] }));
  } });
  assert.equal(result.score, 100);
  assert.equal(result.recommendations[0].evidence, snapshot().title);
  assert.equal(result.model, 'fixture-model');
  assert.match(sent.system, /untrusted/i);
  assert.equal(sent.tool_choice.name, 'seo_recommendations');
  assert.ok(!sent.messages[0].content.includes('private'));
  assert.ok(!sent.messages[0].content.includes(env.ANTHROPIC_API_KEY));
});

test('provider configuration, malformed output, truncation and refusals fail explicitly', async () => {
  await assert.rejects(auditPage(snapshot(), { env: {} }), error => error.status === 503);
  for (const payload of [
    { stop_reason: 'max_tokens', content: [] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'fixture-anthropic-secret' }] },
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'seo_recommendations', input: { summary: 'ok', recommendations: [{ ...recommendation, category: 'invented' }] } }] },
  ]) {
    await assert.rejects(auditPage(snapshot(), { env, fetchImpl: async () => new Response(JSON.stringify(payload)) }),
      error => error.status === 502 && !error.message.includes(env.ANTHROPIC_API_KEY));
  }
});


test('truncated snapshots are labeled as partial evidence in the audit scope', () => {
  const analysis = analyzeSnapshot({ ...snapshot(), truncated: true });
  assert.match(analysis.scope, /truncat|partial/i);
});
