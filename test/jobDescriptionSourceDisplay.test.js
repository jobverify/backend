import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildDescriptionSourceUpdate } from '../src/services/jobDescriptionPolicy.js';
import { createDarwinboxScraper } from '../scraper/darwinbox/script.js';

test('source updates keep native HTML immutable and make its plain display readable', () => {
  const sourceDescription = '<h3>Requirements</h3><p>Use List&lt;T&gt; &amp; preserve 4 years of experience.</p>'
    + '<script>do not display this instruction</script><p hidden>Private template text</p>';
  const update = buildDescriptionSourceUpdate({ title: 'Engineer', company: 'Employer', sourceDescription }, null);
  assert.equal(update.sourceDescription, sourceDescription);
  assert.equal(update.descriptionFormat, 'plain');
  assert.equal(update.description, 'Requirements Use List<T> & preserve 4 years of experience.');
});

test('plain source updates preserve literal comparison and generic-type text', () => {
  const sourceDescription = 'Use List<T> and C++ with x < 5 and y > 2.';
  const update = buildDescriptionSourceUpdate({ title: 'Engineer', sourceDescription }, null);
  assert.equal(update.description, sourceDescription);
});

test('captured Darwinbox content is displayed as text rather than encoded tags or CSS', () => {
  const payload = JSON.parse(readFileSync(new URL('../scraper-support/tests/fixtures/darwinbox/scripbox-native-detail.json', import.meta.url), 'utf8'));
  const record = payload.message.job[0];
  const native = createDarwinboxScraper({ source: 'scripbox', companyName: 'Scripbox', origin: 'https://scripbox.darwinbox.in' });
  const sourceDescription = native.validateJobDetail(payload, { jobId: record.id, title: record.title });
  const update = buildDescriptionSourceUpdate({ title: record.title, company: 'Scripbox', sourceDescription }, null);
  assert.equal(update.sourceDescription, sourceDescription);
  assert.match(update.description, /Scripbox/);
  assert.equal(/<\/?(?:div|span|p)\b|&lt;|font-family|sds-body/.test(update.description), false);
});
