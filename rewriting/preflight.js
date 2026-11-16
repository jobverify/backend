import fs from 'node:fs/promises';
import path from 'node:path';
import { REWRITE_MODEL } from '../src/services/jobDescriptionPolicy.js';
import { prepareRewriteRuntime, startRewriteWorker, rewriteWorkerConfiguration, rewriteGpuLayers } from './worker.js';
import { createRewriteClient, probeRewriteClient } from './runner.js';
import { createRewriteDiagnostics } from './diagnostics.js';
import { captureRewriteError } from './failureDiagnostics.js';

/** Exercise the actual generation contract before a workflow expands its matrix. No database access. */
export async function runRewritePreflight({ env = process.env, outputDirectory = '.cache/scraper-actions',
  signal, deadline = Date.now() + 180000, prepareRuntime = prepareRewriteRuntime, startWorker = startRewriteWorker } = {}) {
  await fs.mkdir(outputDirectory, { recursive: true });
  const summary = { mode: 'readiness', ready: false, modelId: REWRITE_MODEL.modelId,
    modelRevision: REWRITE_MODEL.revision, policyVersion: REWRITE_MODEL.policyVersion, startedAt: new Date().toISOString() };
  const diagnostics = createRewriteDiagnostics();
  let worker;
  const fail = (error, phase) => Object.assign(summary, { ready: false, reason: 'worker_error', error: captureRewriteError(error, { phase }) });
  try {
    const timeout = AbortSignal.timeout(Math.max(1, Math.floor(deadline - Date.now())));
    const bounded = signal ? AbortSignal.any([signal, timeout]) : timeout;
    bounded.throwIfAborted();
    const binaryOverride = env.JOB_DESCRIPTION_REWRITE_BINARY;
    const binarySha256 = env.JOB_DESCRIPTION_REWRITE_BINARY_SHA256;
    if (env.JOB_DESCRIPTION_REWRITE_REQUIRE_CUSTOM_BINARY === '1' && (!binaryOverride || !binarySha256)) {
      throw new Error('The readiness check requires its verified portable runtime');
    }
    const gpuLayers = rewriteGpuLayers(env.JOB_DESCRIPTION_REWRITE_GPU_LAYERS || 0);
    if (gpuLayers !== 0 && (!binaryOverride || !binarySha256)) throw new TypeError('GPU rewriting requires a compatible binary and its SHA-256 checksum');
    const configuration = rewriteWorkerConfiguration({ threads: env.JOB_DESCRIPTION_REWRITE_CPU_THREADS || REWRITE_MODEL.cpuThreads,
      parallelism: env.JOB_DESCRIPTION_REWRITE_CONCURRENCY || 4, gpuLayers });
    summary.environment = { ...configuration, gpuLayers, correctionMode: env.JOB_DESCRIPTION_REWRITE_CORRECTION_MODE || 'adaptive' };
    const runtime = await prepareRuntime({ signal: bounded, binaryOverride, binarySha256 });
    worker = await startWorker({ ...runtime, ...configuration, gpuLayers, deadline, signal: bounded,
      logFile: path.join(outputDirectory, 'description-readiness.log'),
      nativeBacktrace: env.JOB_DESCRIPTION_REWRITE_NATIVE_BACKTRACE === '1' });
    summary.workerProbe = await probeRewriteClient(createRewriteClient({ ...worker, correctionMode: summary.environment.correctionMode }), {
      concurrency: worker.parallelism, deadline, signal: bounded,
      onRejection: rejection => diagnostics.record(rejection),
      onProbeComplete: details => { summary.workerProbe = details; },
    });
    summary.ready = summary.workerProbe.ready;
    if (!summary.ready) Object.assign(summary, { reason: 'model_quality_unavailable', stopReason: 'readiness_rejected' });
  } catch (error) {
    fail(error, 'readiness_preflight');
  } finally {
    try { await worker?.stop(); }
    catch (error) { fail(error, 'readiness_cleanup'); }
  }
  summary.finishedAt = new Date().toISOString();
  const rejected = diagnostics.snapshot();
  summary.rejectionDiagnostics = { file: 'description-readiness-rejections.json', totalRejected: rejected.totalRejected,
    reasons: rejected.reasons, sampleCount: rejected.samples.length };
  await fs.writeFile(path.join(outputDirectory, summary.rejectionDiagnostics.file), JSON.stringify(rejected, null, 2) + '\n');
  await fs.writeFile(path.join(outputDirectory, 'description-readiness.json'), JSON.stringify(summary, null, 2) + '\n');
  return summary;
}
