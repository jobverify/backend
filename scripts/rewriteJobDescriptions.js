import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import '../loadEnv.js';
import { configureMongoDns } from '../src/utils/mongoDns.js';
import Job from '../src/models/Job.js';
import { REWRITE_MODEL } from '../src/services/jobDescriptionPolicy.js';
import { rewriteDeadline, rewriteStopDetails, rewriteQueueQuery, rewriteQueuePages, rewriteFailureDetails, createRewriteClient, rewriteCandidates, probeRewriteClient, rewriteWhenReady, rewriteProgress } from '../rewriting/runner.js';
import { prepareRewriteRuntime, startRewriteWorker, workerMemoryBytes, rewriteWorkerConfiguration, rewriteGpuLayers, collectRewriteRuntimeDiagnostics } from '../rewriting/worker.js';
import { createRewriteDiagnostics } from '../rewriting/diagnostics.js';
import { summarizeRewriteCapacity } from '../rewriting/capacity.js';
import { formatRewriteReport } from '../rewriting/reporting.js';
import { CORRECTION_MODES } from '../rewriting/correctionPolicy.js';
import { createProgressLogger } from './lib/progressLogger.js';

const apply = process.argv.includes('--apply');
const shard = Number(process.env.JOB_DESCRIPTION_REWRITE_SHARD || 0);
const shardCount = Number(process.env.JOB_DESCRIPTION_REWRITE_SHARD_COUNT || 1);
const queueAsOf = process.env.JOB_DESCRIPTION_REWRITE_QUEUE_AS_OF || new Date().toISOString();
if (!Number.isFinite(Date.parse(queueAsOf))) throw new Error('Invalid rewrite queue cutoff');
const query = rewriteQueueQuery(new Date(queueAsOf), { shard, shardCount });
const shardSuffix = shardCount > 1 || process.env.JOB_DESCRIPTION_REWRITE_SHARD !== undefined ? `-${shard}` : '';
const mode = process.env.JOB_DESCRIPTION_REWRITE_MODE || 'off';
const gpuLayers = rewriteGpuLayers(process.env.JOB_DESCRIPTION_REWRITE_GPU_LAYERS || 0);
const correctionMode = process.env.JOB_DESCRIPTION_REWRITE_CORRECTION_MODE || 'adaptive';
if (!CORRECTION_MODES.includes(correctionMode)) throw new TypeError('Invalid prose correction mode');
const workerConfig = rewriteWorkerConfiguration({ threads: process.env.JOB_DESCRIPTION_REWRITE_CPU_THREADS || REWRITE_MODEL.cpuThreads,
  parallelism: process.env.JOB_DESCRIPTION_REWRITE_CONCURRENCY || 1, gpuLayers });
const binaryOverride = process.env.JOB_DESCRIPTION_REWRITE_BINARY;
const binarySha256 = process.env.JOB_DESCRIPTION_REWRITE_BINARY_SHA256;
if (gpuLayers !== 0 && (!binaryOverride || !binarySha256)) throw new TypeError('GPU rewriting requires a compatible binary and its SHA-256 checksum');
if (!['off', 'publish'].includes(mode)) throw new Error('JOB_DESCRIPTION_REWRITE_MODE must be off or publish');
const summary = { mode: apply ? mode : 'preview', shard, shardCount, queueAsOf, modelId: REWRITE_MODEL.modelId, modelFile: REWRITE_MODEL.file,
  modelRevision: REWRITE_MODEL.revision, policyVersion: REWRITE_MODEL.policyVersion, outputFormat: REWRITE_MODEL.outputFormat,
  startedAt: new Date().toISOString(), environment: { platform: os.platform(), cpu: os.cpus()[0]?.model,
    availableCpus: os.availableParallelism(), cpuThreads: workerConfig.threads, parallelism: workerConfig.parallelism, gpuLayers, correctionMode,
    contextTokensPerRequest: REWRITE_MODEL.contextTokens, maxOutputTokens: REWRITE_MODEL.maxOutputTokens,
    maxRetryOutputTokens: REWRITE_MODEL.maxRetryOutputTokens, maxModelEdits: REWRITE_MODEL.maxModelEdits,
    maxPromptCandidates: REWRITE_MODEL.maxPromptCandidates, maxEditCharacters: REWRITE_MODEL.maxEditCharacters, queuePageSize: 8,
    requestSeconds: REWRITE_MODEL.requestSeconds, totalMemoryBytes: os.totalmem() } };
const summaryFile = path.resolve(process.env.PIPELINE_SUMMARY_FILE || `.cache/scraper-actions/description-summary${shardSuffix}.json`);
if (REWRITE_MODEL.outputFormat === 'prose') {
  for (const key of ['maxOutputTokens', 'maxRetryOutputTokens', 'maxModelEdits', 'maxPromptCandidates', 'maxEditCharacters', 'requestSeconds']) delete summary.environment[key];
  summary.environment.outputSizing = 'source_tokens_with_formatting_headroom';
  summary.environment.requestDeadline = 'remaining_workflow_budget';
}
const diagnosticFile = path.join(path.dirname(summaryFile), `description-rejections${shardSuffix}.json`);
const diagnostics = createRewriteDiagnostics();
const onRejection = rejection => diagnostics.record(rejection);
const onFragmentRejection = rejection => diagnostics.record({ ...rejection, kind: 'fragment' });
const deadline = rewriteDeadline({ budgetSeconds: process.env.JOB_DESCRIPTION_REWRITE_BUDGET_SECONDS || 1200,
  workflowStartedAt: process.env.JOB_DESCRIPTION_WORKFLOW_STARTED_AT, workflowSeconds: process.env.JOB_DESCRIPTION_WORKFLOW_BUDGET_SECONDS || 9000 });
const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => controller.abort());
const budgetSignal = AbortSignal.timeout(Math.max(1, Math.floor(deadline - Date.now())));
const signal = AbortSignal.any([controller.signal, budgetSignal]);
let worker, jobs, phase = 'configuration';
const progress = createProgressLogger('rewrite', () => ({
  mode: summary.mode, shard, shardCount, queued: summary.queued, processed: summary.results?.filter(result => !result.interrupted).length || 0,
  remaining: summary.queued === undefined ? undefined : Math.max(0, summary.queued - (summary.results?.filter(result => !result.interrupted).length || 0)),
}));
const setPhase = value => { phase = value; progress.phase(value); };
try {
  setPhase('configuration');
  if (apply && mode !== 'publish') summary.reason = 'disabled';
  else if (Date.now() >= deadline) summary.reason = 'workflow_budget_exhausted';
  else {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
    configureMongoDns();
    setPhase('connect');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: Math.max(1, Math.min(15000, deadline - Date.now())) });
    setPhase('count_queue');
    summary.queued = await Job.countDocuments(query).maxTimeMS(15000);
    if (!apply || !summary.queued) summary.reason = apply ? 'empty_queue' : 'read_only_preview';
    else {
        signal.throwIfAborted();
        setPhase('prepare_runtime');
        if (process.env.JOB_DESCRIPTION_REWRITE_REQUIRE_CUSTOM_BINARY === '1' && (!binaryOverride || !binarySha256)) {
          throw new Error('The rewrite workflow requires its verified portable runtime before processing a nonempty queue');
        }
        const runtime = await prepareRewriteRuntime({ signal, binaryOverride, binarySha256 });
        summary.workerRuntime = await collectRewriteRuntimeDiagnostics({ binary: runtime.binary,
          nativeBacktrace: process.env.JOB_DESCRIPTION_REWRITE_NATIVE_BACKTRACE === '1' });
        summary.workerRuntime.runtimeKind = runtime.runtimeKind;
        if (binaryOverride && process.env.JOB_DESCRIPTION_REWRITE_RUNTIME_PROFILE) {
          summary.workerRuntime.profile = process.env.JOB_DESCRIPTION_REWRITE_RUNTIME_PROFILE;
          summary.workerRuntime.sourceRevision = process.env.JOB_DESCRIPTION_REWRITE_RUNTIME_SOURCE_REVISION;
        }
        setPhase('start_worker');
        worker = await startRewriteWorker({ ...runtime, signal, deadline,
          nativeBacktrace: summary.workerRuntime.nativeBacktrace.enabled,
          logFile: path.join(path.dirname(summaryFile), `description-worker${shardSuffix}.log`),
          threads: workerConfig.threads, parallelism: workerConfig.parallelism, gpuLayers });
        setPhase('probe_worker');
        summary.workerProbe = await probeRewriteClient(createRewriteClient({ ...worker, correctionMode }), { concurrency: worker.parallelism, deadline, signal, onRejection,
          onProbeComplete: details => { summary.workerProbe = details; },
          onProbeEvent: event => console.log(JSON.stringify({ mode: summary.mode, shard, shardCount, ...event })) });
        summary.results = [];
        Object.assign(summary, await rewriteWhenReady(summary.workerProbe, async () => {
        setPhase('process_queue');
        jobs = rewriteQueuePages(Job, query, { pageSize: 8, deadline, signal });
        return rewriteCandidates(jobs, { client: createRewriteClient({ ...worker, correctionMode, planCacheDir: '.cache/description-rewrites' }), deadline, signal, concurrency: worker.parallelism, onRejection, onFragmentRejection,
          update: async (filter, update) => {
            try { return await Job.updateOne(filter, update, { runValidators: true, maxTimeMS: 15000 }); }
            catch (error) { error.rewritePhase = 'update_job'; throw error; }
          },
          onResult: result => { summary.results.push(result); console.log(JSON.stringify(result)); },
        });
        }));
    }
  }
} catch (error) {
  if (error.rewriteStats) Object.assign(summary, error.rewriteStats);
  const expectedStop = signal.aborted && (['AbortError', 'TimeoutError'].includes(error.name) || error === signal.reason);
  if (expectedStop) Object.assign(summary, rewriteStopDetails({ cancelled: controller.signal.aborted, budgetExpired: budgetSignal.aborted || Date.now() >= deadline }));
  else {
    summary.reason = 'worker_error';
    // Never hide a code/database/worker failure that coincides with the deadline.
    Object.assign(summary, rewriteFailureDetails(error, error.rewritePhase || phase));
    process.exitCode = 1;
  }
} finally {
  // Stop the heartbeat even if worker or database cleanup fails.
  progress.stop();
  setPhase('cleanup');
  await jobs?.return();
  if (worker) summary.worker = worker.diagnostics();
  if (worker) summary.workerMemoryBytes = await workerMemoryBytes(worker.pid).catch(() => null);
  await worker?.stop();
  await mongoose.disconnect();
  if (summary.results?.length) {
    summary.capacity = summarizeRewriteCapacity(summary.results, {
      startedAt: summary.startedAt, finishedAt: new Date().toISOString(), attempted: summary.attempted,
    });
  }
  if (apply && summary.queued !== undefined) Object.assign(summary, rewriteProgress(summary));
  if (apply && !summary.errorType && summary.reason !== 'disabled') Object.assign(summary,
    rewriteStopDetails({ cancelled: controller.signal.aborted, budgetExpired: budgetSignal.aborted || Date.now() >= deadline || summary.reason === 'workflow_budget_exhausted' }));
  summary.finishedAt = new Date().toISOString();
  if (apply) {
    const { stageOutcome, describeStageCompletion } = await import('../src/pipeline/policy.js');
    summary.outcome = stageOutcome('rewrite', summary, process.exitCode || 0);
    Object.assign(summary, describeStageCompletion('rewrite', summary, summary.outcome));
    if (summary.outcome !== 'completed') process.exitCode = 1;
  }
  await fs.mkdir(path.dirname(summaryFile), { recursive: true });
  if (apply) {
    const rejected = diagnostics.snapshot();
    summary.rejectionDiagnostics = { file: path.basename(diagnosticFile), totalRejected: rejected.totalRejected,
      totalRejectedFragments: rejected.totalRejectedFragments, fragmentReasons: rejected.fragmentReasons,
      sampleCount: rejected.samples.length, reasons: rejected.reasons, maxSamples: rejected.maxSamples, maxBytes: rejected.maxBytes };
    await fs.writeFile(diagnosticFile + '.tmp', JSON.stringify(rejected) + '\n');
    await fs.rename(diagnosticFile + '.tmp', diagnosticFile);
  }
  await fs.writeFile(summaryFile + '.tmp', JSON.stringify(summary, null, 2) + '\n');
  await fs.rename(summaryFile + '.tmp', summaryFile);
  if (apply) {
    const report = formatRewriteReport(summary);
    await fs.writeFile(path.join(path.dirname(summaryFile), path.parse(summaryFile).name + '.md'), report);
    if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, report);
  }
  console.log(JSON.stringify({ ...summary, results: summary.results?.length }));
}
