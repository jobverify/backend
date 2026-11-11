import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDescriptionSourceUpdate } from '../src/services/jobDescriptionPolicy.js';
import { createDarwinboxScraper } from '../scraper/darwinbox/script.js';

test('source updates keep native HTML immutable and preserve readable display structure', () => {
  const sourceDescription = '<h3>Requirements</h3><p>Use List&lt;T&gt; &amp; preserve 4 years of experience.</p>'
    + '<script>do not display this instruction</script><p hidden>Private template text</p>';
  const update = buildDescriptionSourceUpdate({ title: 'Engineer', company: 'Employer', sourceDescription }, null);
  assert.equal(update.sourceDescription, sourceDescription);
  assert.equal(update.descriptionFormat, 'markdown');
  assert.equal(update.description, '## Requirements\n\nUse List<T> & preserve 4 years of experience.');
});

test('plain source updates preserve literal comparison and generic-type text', () => {
  const sourceDescription = 'Use List<T> and C++ with x < 5 and y > 2.';
  const update = buildDescriptionSourceUpdate({ title: 'Engineer', sourceDescription }, null);
  assert.equal(update.description, sourceDescription);
});

test('Darwinbox rich text is displayed as employer content rather than encoded tags or CSS', () => {
  const record = { id: 'description-display-fixture', title: 'Engineer', officelocation_show_arr: 'Bengaluru, India',
    jd: '<div class="sds-body" style="font-family: Arial"><p>Build Scripbox products with the engineering team.</p><p>Test services and document your decisions.</p></div>' };
  const payload = { status: 'success', message: { job: [record] } };
  const native = createDarwinboxScraper({ source: 'scripbox', companyName: 'Scripbox', origin: 'https://scripbox.darwinbox.in' });
  const sourceDescription = native.validateJobDetail(payload, { jobId: record.id, title: record.title });
  const update = buildDescriptionSourceUpdate({ title: record.title, company: 'Scripbox', sourceDescription }, null);
  assert.equal(update.sourceDescription, sourceDescription);
  assert.match(update.description, /Scripbox/);
  assert.equal(/<\/?(?:div|span|p)\b|&lt;|font-family|sds-body/.test(update.description), false);
});
