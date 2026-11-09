import test from 'node:test';
import assert from 'node:assert/strict';
import { createRewriteDiagnostics } from '../rewriting/diagnostics.js';

test('rejection diagnostics retain useful source/output context with strict count and byte limits', () => {
  const diagnostics = createRewriteDiagnostics({ maxSamples: 2, maxBytes: 12000 });
  for (let i = 0; i < 6; i++) diagnostics.record({ id: 'job-' + i, reason: 'unsupported_claim',
    input: { inputHash: 'a'.repeat(64), sourceDescription: 'Source description. '.repeat(1000) },
    response: { rawValue: { sections: [{ text: 'Generated description. '.repeat(1000) }] } },
    diagnostic: { section: 'overview', itemIndex: 0, text: 'Unstated Kubernetes skill.', evidence: 'Python services.' } });
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.totalRejected, 6); assert.equal(snapshot.reasons.unsupported_claim, 6);
  assert.equal(snapshot.samples.length, 2); assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) <= 12000);
  assert.equal(snapshot.samples[0].validation.text, 'Unstated Kubernetes skill.');
  assert.match(snapshot.samples[0].sourceContext, /Python services/);
});

test('diagnostics omit exception messages, configuration and unrelated model fields', () => {
  const diagnostics = createRewriteDiagnostics();
  diagnostics.record({ id: 'job', reason: 'timeout', error: new Error('mongodb://user:password@private'),
    MONGO_URI: 'private database', input: { inputHash: 'hash', sourceDescription: 'Public employer wording.' },
    response: { value: { sections: [] }, headers: { Authorization: 'Bearer secret' } } });
  const text = JSON.stringify(diagnostics.snapshot());
  assert.doesNotMatch(text, /mongodb|password|MONGO_URI|Authorization|Bearer/);
  assert.match(text, /Public employer wording/);
});

test('edit rejection artifacts retain the rule and exact selected source for replay', () => {
  const diagnostics = createRewriteDiagnostics();
  diagnostics.record({ reason: 'source_words_changed', diagnostic: { code: 'source_words_changed',
    sourceId: 33, itemIndex: 0, text: 'Build APIs.', evidence: 'Build and maintain APIs.',
    configuration: 'must not leak' } });
  const sample = diagnostics.snapshot().samples[0];
  assert.equal(sample.validation.code, 'source_words_changed');
  assert.equal(sample.validation.sourceId, 33);
  assert.equal(sample.validation.evidence, 'Build and maintain APIs.');
  assert.equal(sample.validation.configuration, undefined);
});

test('partial output is preserved and repeated truncations leave room for other rejection reasons', () => {
  const diagnostics = createRewriteDiagnostics();
  for (let i = 0; i < 28; i++) diagnostics.record({ id: String(i), reason: 'truncated',
    input: { sourceDescription: 'Employer source.' }, response: { rawValue: null, value: null, rawText: '{"edits":[{"source":0' } });
  for (const reason of ['timeout','unsupported_claim','relationship_changed']) diagnostics.record({ reason,
    input: { sourceDescription: 'Employer source.' }, response: { rawText: 'partial text' } });
  const result = diagnostics.snapshot();
  assert.equal(result.reasons.truncated, 28); assert.equal(result.totalRejected, 31);
  assert.equal(result.samples.filter(sample => sample.reason === 'truncated').length, 2);
  for (const reason of ['timeout','unsupported_claim','relationship_changed']) assert.ok(result.samples.some(sample => sample.reason === reason));
  assert.equal(result.samples[0].completionPreview, '{"edits":[{"source":0');
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 65536);
});

test('startup probe samples cannot occupy the production numeric rejection samples', () => {
  const diagnostics = createRewriteDiagnostics();
  for (const id of ['worker-probe-0', 'worker-probe-1', 'worker-probe-2', 'worker-probe-3', 'real-job']) {
    diagnostics.record({ id, reason: 'numeric_relationship_changed', input: { sourceDescription: 'At least 2 years.' },
      response: { rawText: 'At least 10 years.' } });
  }
  const result = diagnostics.snapshot();
  assert.equal(result.totalRejected, 5);
  assert.ok(result.samples.some(sample => sample.id === 'real-job'));
  assert.ok(result.samples.length <= 10);
});

test('readiness diagnostics retain the full synthetic source separately from the failing statement', () => {
  const diagnostics = createRewriteDiagnostics();
  const sourceDescription = 'Role overview: Build Python services for customer group 2. Required qualifications: At least 2 years is required. Preferred qualifications: AWS is nice to have.';
  for (const id of ['worker-probe-1', 'production-job']) diagnostics.record({ id, reason: 'numeric_relationship_changed',
    input: { sourceDescription }, diagnostic: { evidence: 'Build Python services for customer group 2.' } });
  const [probe, production] = diagnostics.snapshot().samples;
  assert.equal(probe.probeSource, sourceDescription);
  assert.equal(probe.sourceContext, 'Build Python services for customer group 2.');
  assert.equal(production.probeSource, undefined);
});

test('assembly failure evidence uses the actual failing candidate and context rather than a stale completion', () => {
  const diagnostics = createRewriteDiagnostics();
  diagnostics.record({ id: 'assembly-job', reason: 'source_details_changed',
    input: { sourceDescription: 'Build services. Maintain tests.' },
    response: { rawText: '{"text":"last unrelated fragment"}' },
    diagnostic: { phase: 'assembly', code: 'source_details_changed', scope: 'required',
      evidence: 'Maintain tests.', text: 'Invented skills.', sectionContext: 'Requirements' } });
  const sample = diagnostics.snapshot().samples[0];
  assert.equal(sample.validation.phase, 'assembly');
  assert.equal(sample.validation.sectionContext, 'Requirements');
  assert.equal(JSON.parse(sample.completionPreview).text, 'Invented skills.');
  assert.equal(sample.sourceContext, 'Maintain tests.');
});
