import { performance } from 'node:perf_hooks';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { assessDescriptionRewrite, validateDescriptionRewrite, RewriteGenerationError } from './runner.js';
import { MAX_REWRITE_CONCURRENCY } from './worker.js';

const summarize = (rows, targetMs, elapsedMs) => {
  const durations = rows.map(row => row.durationMs).sort((a, b) => a - b);
  const percentile = fraction => durations.length ? durations[Math.max(0, Math.ceil(durations.length * fraction) - 1)] : null;
  const accepted = rows.filter(row => row.accepted);
  const wordingEdited = accepted.filter(row => row.quality?.modelWordingEditedBlocks > 0).length;
  const wordingRecorded = accepted.filter(row => Number.isInteger(row.quality?.modelWordingEditedBlocks)).length;
  return { requests: rows.length, accepted: accepted.length,
    wordingEdited, wordingMetricsRecordedDescriptions: wordingRecorded,
    wordingEditedPerHour: wordingRecorded !== accepted.length ? null : elapsedMs ? wordingEdited / elapsedMs * 3600000 : 0,
    fallbackDescriptions: accepted.filter(row => row.quality?.sourceFallbackBlocks > 0).length,
    ...Object.fromEntries(['correctionRequests', 'correctionsAccepted', 'correctionsRejected', 'correctionsSkipped']
      .map(key => [key, rows.reduce((sum, row) => sum + (row[key] || 0), 0)])),
    rejected: rows.filter(row => !row.accepted).length,
    acceptedUnderTarget: rows.filter(row => row.accepted && row.durationMs <= targetMs).length,
    modelRequests: rows.reduce((sum, row) => sum + row.generationRequests, 0),
    p50DurationMs: percentile(.5), p95DurationMs: percentile(.95), maxDurationMs: durations.at(-1) ?? null };
};

export const measureRewriteWarmup = async (input, { client, signal, deadline = Date.now() + 600000, onResult = () => {} } = {}) => {
  const began = performance.now();
  let response, error;
  try { response = await client.generate(input, { signal, remainingMs: deadline - Date.now(), cacheMode: 'refresh', allowSourceFallback: false }); }
  catch (failure) { error = failure; response = failure; }
  const checked = error ? { ok: false, reason: error.name === 'TimeoutError' ? 'timeout' : 'generation_error' }
    : response.validationFailure || validateDescriptionRewrite(response.value, input, response.finishReason, response.format || client.format);
  const row = { durationMs: performance.now() - began, accepted: checked.ok, reason: checked.reason,
    generationRequests: response?.generationRequests ?? null, outputReceived: Boolean(response?.value || response?.rawText),
    completionPreview: response?.rawText?.slice(0, 2400), usage: response?.usage, timings: response?.timings, errorType: error?.name };
  await onResult(row);
  if (error) throw error;
  return row;
};

/** Measures complete client generation and validation; never publishes or connects to MongoDB. */
export const benchmarkRewriteLatency = async (jobs, { client, concurrency = 1, cacheMode = 'refresh', targetMs = 3000, allowSourceFallback = false,
  signal, deadline = Date.now() + 600000, onResult = () => {} } = {}) => {
  if (!Array.isArray(jobs) || !jobs.length) throw new TypeError('Latency benchmark needs source jobs');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_REWRITE_CONCURRENCY) throw new RangeError('Benchmark concurrency must be between one and ' + MAX_REWRITE_CONCURRENCY);
  if (!Number.isFinite(targetMs) || targetMs <= 0 || !['use', 'refresh'].includes(cacheMode)
    || typeof allowSourceFallback !== 'boolean') throw new RangeError('Invalid latency benchmark settings');
  const rows = new Array(jobs.length);
  const began = performance.now();
  let next = 0, failure;
  const worker = async () => {
    while (!failure && next < jobs.length) {
      const index = next++;
      try {
        signal?.throwIfAborted();
        if (Date.now() >= deadline) throw new DOMException('Latency benchmark budget exhausted', 'TimeoutError');
        const input = buildRewriteInput(jobs[index]);
        const started = performance.now();
        const assessment = assessDescriptionRewrite(input, client.format);
        let response, checked;
        if (!assessment.ok) checked = assessment;
        else {
          try {
            response = await client.generate(input, { signal, remainingMs: deadline - Date.now(), cacheMode, allowSourceFallback });
            signal?.throwIfAborted();
            checked = response.finishReason === 'stop' && response.validationFailure ? response.validationFailure
              : validateDescriptionRewrite(response.value, input, response.finishReason, response.format || client.format);
          } catch (error) {
            if (signal?.aborted || !(error instanceof RewriteGenerationError || error.name === 'TimeoutError')) throw error;
            response = { rawText: error.rawText, generationRequests: error.generationRequests, usage: error.usage, timings: error.timings,
              correctionRequests: error.correctionRequests, correctionsAccepted: error.correctionsAccepted,
              correctionsRejected: error.correctionsRejected, correctionsSkipped: error.correctionsSkipped };
            checked = { ok: false, reason: error.name === 'TimeoutError' ? 'timeout' : 'generation_error' };
          }
        }
        const kind = response?.sharedGeneration ? 'shared' : response?.cachedModelPlan ? 'cached' : 'fresh';
        const row = { index: index + 1, inputHash: input.inputHash, title: input.facts.title, company: input.facts.company,
          kind, durationMs: Math.round((performance.now() - started) * 1000) / 1000,
          accepted: checked.ok, reason: checked.reason, originalDescription: input.sourceDescription, description: checked.description,
          quality: checked.quality,
          correctionRequests: response?.correctionRequests, correctionsAccepted: response?.correctionsAccepted,
          correctionsRejected: response?.correctionsRejected, correctionsSkipped: response?.correctionsSkipped,
          completionPreview: response?.rawText?.slice(0, 2400), validation: checked.diagnostic,
          generationRequests: response?.generationRequests ?? (assessment.ok ? 1 : 0),
          outputReceived: Boolean(response?.value || response?.rawText),
          cacheSource: response?.cacheSource, usage: response?.usage, timings: response?.timings, generations: response?.generations };
        rows[index] = row;
        await onResult(row);
      } catch (error) { failure ??= error; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  if (failure) throw failure;
  const elapsedMs = performance.now() - began;
  const summary = { all: summarize(rows, targetMs, elapsedMs), fresh: summarize(rows.filter(row => row.kind === 'fresh'), targetMs, elapsedMs),
    cached: summarize(rows.filter(row => row.kind === 'cached'), targetMs, elapsedMs), shared: summarize(rows.filter(row => row.kind === 'shared'), targetMs, elapsedMs) };
  return { cacheMode, concurrency, targetMs, allowSourceFallback, elapsedMs, requestsPerSecond: rows.length / (elapsedMs / 1000),
    throughputIncludesResultRecording: true, rows, summary };
};
