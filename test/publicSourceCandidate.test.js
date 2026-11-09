import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSourceCandidate } from '../rewriting/publicSourceCandidate.js';

const body = 'Responsibilities: Lead engineering projects across the organization. Coordinate design reviews, schedule delivery milestones, and support the engineering team. Qualifications: A relevant engineering degree and experience delivering hardware projects are required.';

test('newly fetched source text remains available despite the original empty sourceDescription', () => {
  const original = {title: 'Engineering Program Manager', sourceDescription: '', jobDescription: null};
  const enriched = {...original, jobDescription: body, publicExperienceChecked: true};
  const candidate = publicSourceCandidate(original, enriched);
  assert.equal(candidate.kind, 'candidate');
  assert.equal(candidate.input.sourceDescription, body);
  assert.equal(candidate.job.sourceDescription, body);
  assert.equal(original.sourceDescription, '');
  assert.equal(enriched.sourceDescription, '');
});

test('the recovery experiment never replaces an existing captured description', () => {
  const original = {title: 'Engineer', sourceDescription: body};
  assert.equal(publicSourceCandidate(original, {...original, jobDescription: 'Different page'}).kind, 'already_present');
});

test('a truncated listing excerpt is distinguished from a full description candidate', () => {
  const original = {title: 'Engineer', sourceDescription: ''};
  assert.equal(publicSourceCandidate(original, {...original, jobDescription: body + ' ...'}).kind, 'listing_excerpt');
});
