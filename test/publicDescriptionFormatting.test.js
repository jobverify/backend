import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeResponseJob } from '../src/controllers/jobController.js';

test('legacy flattened descriptions recover employer structure on public reads without rewriting stored records', () => {
  const job = { title: 'Engineer', company: 'Employer', description: 'Responsibilities Build APIs. Test changes.', descriptionFormat: 'plain',
    sourceDescription: '<h2>Responsibilities</h2><ul><li>Build APIs.</li><li>Test changes.</li></ul>', descriptionRewrite: { status: 'baseline' } };
  const original = structuredClone(job);
  const response = normalizeResponseJob(job);
  assert.equal(response.description, '## Responsibilities\n\n- Build APIs.\n- Test changes.');
  assert.equal(response.descriptionFormat, 'markdown');
  assert.equal('sourceDescription' in response, false);
  assert.equal('descriptionRewrite' in response, false);
  assert.deepEqual(job, original);
});

test('accepted markdown rewrites remain the public display instead of being replaced with source text', () => {
  const description = '## Responsibilities\n\n- Build reliable APIs with the engineering team.';
  const response = normalizeResponseJob({ title: 'Engineer', description, descriptionFormat: 'markdown',
    sourceDescription: '<p>Original employer wording.</p>', descriptionRewrite: { status: 'published' } });
  assert.equal(response.description, description);
  assert.equal(response.descriptionFormat, 'markdown');
});

test('plain employer paragraph breaks replace flattened baseline text and explicitly empty source cannot become filler', () => {
  const response = normalizeResponseJob({ title: 'Engineer', description: 'Flattened display text.', descriptionFormat: 'plain', sourceDescription: 'Build reliable services.\n\nWork with the engineering team.' });
  assert.equal(response.description, 'Build reliable services.\n\nWork with the engineering team.');
  assert.equal(normalizeResponseJob({ title: 'Engineer', sourceDescription: '', description: 'This role is an open opportunity.' }).description, '');
});

test('summary cards do not acquire description fields and malformed markup cannot break a public response', () => {
  assert.equal('description' in normalizeResponseJob({ title: 'Engineer', company: 'Employer' }), false);
  const response = normalizeResponseJob({ title: 'Engineer', description: 'Safe existing text.', sourceDescription: '<p title="unterminated>Broken source' });
  assert.equal(response.description, 'Safe existing text.');
});
