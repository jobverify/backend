import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSourceDescription } from '../src/utils/jobSourceContent.js';

test('editor prompts do not count as employer descriptions', () => {
  for (const description of ['Enter job description', '<p>Enter job description</p>', ' ENTER THE JOB DESCRIPTION. ']) {
    assert.equal(hasSourceDescription({ sourceDescription: description }), false, description);
  }
  assert.equal(hasSourceDescription({ sourceDescription: 'Enter job description\nBuild APIs and lead engineers.' }), true);
  assert.equal(hasSourceDescription({ sourceDescription: 'Build APIs and lead engineers.' }), true);
});
