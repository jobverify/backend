import test from 'node:test';
import assert from 'node:assert/strict';
import { safeResumeDiagnostic, resumeFailure } from '../resume-tailoring/resumeDiagnostics.js';

test('diagnostics permit fixed codes, stages and bounded numbers only', () => {
  const event = safeResumeDiagnostic({ stage: 'compiling', code: 'compiler_dependency_missing', attempt: 2, seconds: 3.5,
    message: 'private resume', latex: '\\documentclass', email: 'private@example.test', issueCount: 4 });
  assert.deepEqual(event, { stage: 'compiling', code: 'compiler_dependency_missing', attempt: 2, seconds: 3.5, issueCount: 4 });
  const untrusted = safeResumeDiagnostic({ stage: 'private resume', code: 'private@example.test', attempt: 'private', seconds: Infinity });
  assert.deepEqual(untrusted, { stage: 'worker', code: 'processing_failed' });
  assert.doesNotMatch(JSON.stringify(resumeFailure('private@example.test')), /private/);
});

test('only allowlisted LaTeX validation reasons can appear in public diagnostics', () => {
  assert.deepEqual(safeResumeDiagnostic({ stage: 'latex', code: 'latex_invalid', reason: 'unsupported_package' }),
    { stage: 'latex', code: 'latex_invalid', reason: 'unsupported_package' });
  for (const reason of ['private@example.test', 'toString', '__proto__', { text: 'private' }, undefined]) {
    assert.deepEqual(safeResumeDiagnostic({ stage: 'latex', code: 'latex_invalid', reason }),
      { stage: 'latex', code: 'latex_invalid' });
  }
  assert.deepEqual(safeResumeDiagnostic({ stage: 'compiling', code: 'compiler_failed', reason: 'unsupported_package' }),
    { stage: 'compiling', code: 'compiler_failed' });
});

test('factual diagnostics expose bounded category counts without candidate facts', () => {
  const issueCounts = { contact: 1, employment: 1, date: 1, skill: 1, metric: 1 };
  const event = { stage: 'validating', code: 'factual_validation_failed', issueCounts: {
    ...issueCounts, 'private@example.test': 1, other: 'private text', identity: Infinity, education: -1, title: 1.5, link: 1000001,
  } };
  assert.deepEqual(safeResumeDiagnostic(event), { stage: 'validating', code: 'factual_validation_failed', issueCounts });
  assert.deepEqual(safeResumeDiagnostic({ ...event, stage: 'compiling' }), { stage: 'compiling', code: 'factual_validation_failed' });
  assert.doesNotMatch(JSON.stringify(safeResumeDiagnostic(event)), /private|Private/);
});
