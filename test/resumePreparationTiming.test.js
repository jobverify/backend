import test from 'node:test';
import assert from 'node:assert/strict';
import { preparationTiming, preparationDurations } from '../src/services/resumePreparationTiming.js';

test('uses successful preparation durations and keeps a bounded recent average', () => {
  const preparation = { status: 'completed', requestedAt: '2026-11-07T10:00:00Z', generatedAt: '2026-11-07T10:02:00Z', durationSamples: [60000] };
  assert.deepEqual(preparationDurations(preparation), [60000, 120000]);
  assert.equal(preparationTiming(preparation).averageDurationMs, 90000);
  assert.equal(preparationDurations({ ...preparation, durationSamples: Array(25).fill(60000) }).length, 20);
});

test('failed, active and invalid durations never affect the average', () => {
  assert.equal(preparationTiming({ status: 'running' }).averageDurationMs, null);
  assert.deepEqual(preparationDurations({ status: 'failed', requestedAt: '2026-11-07T10:00:00Z', generatedAt: '2026-11-07T10:02:00Z', durationSamples: [0, -1, null, 60000] }), [60000]);
  assert.deepEqual(preparationDurations({ status: 'completed', requestedAt: 'invalid', generatedAt: 'invalid' }), []);
});
