import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJobDetail } from '../scraper/volkswagengrouptechnologysolutionsindia/script.js';
import { extractSearchResults } from '../scraper/ascendion/script.js';
import { buildSourceDescriptionDisplay } from '../src/utils/jobDescriptionDisplay.js';

test('a missing SuccessFactors role body cannot fall back to page scripts or localization', () => {
  const html = '<title>Career Opportunities: SAP Expert (10496)</title><script>var M={RECRUITING_JOB_DESCRIPTION:"Job Description",RECRUITING_RATING_SCALE_NAME:"Rating scale",RECRUITING_REMOVE_ANSWER:"Remove answer"};</script><main>The requested position is unavailable.</main>';
  const result = extractJobDetail(html, { title: 'SAP Expert', jobId: '10496' });
  assert.equal(result.jobDescription, null);
});

test('nested SuccessFactors description containers keep all active role content', () => {
  const html = '<title>Career Opportunities: SAP Expert (10496)</title><div class="content jobdescription"><div><h2>Responsibilities</h2><p>Build SAP interfaces.</p></div><ul><li>Do not request passwords.</li><li>At least 2 years of SAP experience is required.</li></ul></div><script>RECRUITING_REMOVE_ANSWER="Remove answer";</script>';
  const result = extractJobDetail(html, { title: 'SAP Expert', jobId: '10496' });
  assert.match(result.jobDescription, /Build SAP interfaces/);
  assert.match(result.jobDescription, /Do not request passwords/);
  assert.match(result.jobDescription, /2 years of SAP experience/);
  assert.doesNotMatch(result.jobDescription, /RECRUITING_|Remove answer/);
});

test('SuccessFactors native numbered instructions preserve their start and explicit item values', () => {
  const html = '<title>Career Opportunities: Engineer (10496)</title><div class="jobdescription"><ol start="5"><li>Send your CV.</li><li value="7">Attend only if invited.</li></ol></div>';
  const result = extractJobDetail(html);
  const display = buildSourceDescriptionDisplay(result.sourceDescription);
  assert.match(display.description, /5\. Send your CV/);
  assert.match(display.description, /7\. Attend only if invited/);
});

test('Ascendion keeps native rich-text source so list and heading structure survives persistence', () => {
  const source = '<h2>Responsibilities</h2><ul><li>Build Python services.</li><li>Maintain automated tests.</li></ul>';
  const jobs = extractSearchResults({ data: { positions: [{ id: '1970324837529467', name: 'Engineer', locations: ['India'] }] } }, {
    detailPayloadById: { 1970324837529467: { data: { id: 1970324837529467, name: 'Engineer', locations: ['India'], jobDescription: source } } },
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].sourceDescription, source);
  assert.match(jobs[0].jobDescription, /Build Python services/);
});
