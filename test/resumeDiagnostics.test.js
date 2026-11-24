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

test('model progress permits bounded counters and excludes slot contents', () => {
  assert.deepEqual(safeResumeDiagnostic({ stage: 'generating', code: 'progress', seconds: 60, inputTokens: 7563,
    processedTokens: 4096, outputTokens: 122, params: { prompt: 'private source' } }),
  { stage: 'generating', code: 'progress', seconds: 60, inputTokens: 7563, processedTokens: 4096, outputTokens: 122 });
  assert.equal(safeResumeDiagnostic({ stage: 'generating', code: 'progress', processedTokens: 'private' }).processedTokens, undefined);
});

test('tailoring path diagnostics expose only fixed compatibility reasons and base kinds', () => {
  assert.deepEqual(safeResumeDiagnostic({ stage: 'generating', code: 'started', policyVersion: 'abey-tailoring-v3',
    generationKind: 'edits', baseKind: 'source', tailoringReason: 'template_mismatch', editSlotCount: 12 }), {
    stage: 'generating', code: 'started', editSlotCount: 12, policyVersion: 'abey-tailoring-v3', generationKind: 'edits',
    baseKind: 'source', tailoringReason: 'template_mismatch',
  });
  assert.deepEqual(safeResumeDiagnostic({ stage: 'generating', code: 'started',
    generationKind: 'private', baseKind: 'private@example.test', tailoringReason: 'private source' }), { stage: 'generating', code: 'started' });
});

test('deployment and repair diagnostics allow only fixed policy values and bounded measurements', () => {
  const event = safeResumeDiagnostic({ stage: 'repairing', code: 'repair_budget_insufficient',
    policyVersion: 'abey-pagination-v2', mode: 'base', repairKind: 'pagination', targetPages: 2, sourceBlockCount: 54,
    estimatedSeconds: 600, remainingSeconds: 400, prompt: 'private resume' });
  assert.deepEqual(event, { stage: 'repairing', code: 'repair_budget_insufficient', targetPages: 2, sourceBlockCount: 54,
    estimatedSeconds: 600, remainingSeconds: 400, policyVersion: 'abey-pagination-v2', mode: 'base', repairKind: 'pagination' });
  assert.deepEqual(safeResumeDiagnostic({ stage: 'generating', code: 'started', policyVersion: 'private@example.test',
    mode: 'private', repairKind: 'private', targetPages: Infinity, sourceBlockCount: -1 }), { stage: 'generating', code: 'started' });
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

test('compiler diagnostics retain only fixed syntax reasons in the compilation stage', () => {
  assert.deepEqual(safeResumeDiagnostic({ stage: 'compiling', code: 'compiler_failed', reason: 'alignment_tab', stderr: 'private' }),
    { stage: 'compiling', code: 'compiler_failed', reason: 'alignment_tab' });
  for (const reason of ['private@example.test', '__proto__', 'toString', { text: 'private' }]) {
    assert.deepEqual(safeResumeDiagnostic({ stage: 'compiling', code: 'compiler_failed', reason }),
      { stage: 'compiling', code: 'compiler_failed' });
  }
  assert.deepEqual(safeResumeDiagnostic({ stage: 'validating', code: 'compiler_failed', reason: 'alignment_tab' }),
    { stage: 'validating', code: 'compiler_failed' });
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
