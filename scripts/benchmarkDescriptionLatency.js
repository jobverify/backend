import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { REWRITE_MODEL, buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { prepareRewriteRuntime, startRewriteWorker, rewriteGpuLayers, rewriteWorkerConfiguration, MAX_REWRITE_CONCURRENCY } from '../rewriting/worker.js';
import { CORRECTION_MODES } from '../rewriting/correctionPolicy.js';
import { createRewriteClient } from '../rewriting/runner.js';
import { benchmarkRewriteLatency, measureRewriteWarmup } from '../rewriting/latencyBenchmark.js';
import { rewritePolicyIdentity } from '../rewriting/policyIdentity.js';
import { writeFileAtomically } from '../rewriting/atomicFile.js';

const values = new Set(['--input', '--output', '--assets-dir', '--concurrency', '--threads', '--target-ms', '--budget-seconds',
  '--binary', '--binary-sha256', '--gpu-layers', '--port', '--correction-mode']);
let report, outputFile, worker;
let saving = Promise.resolve();
const save = () => saving = saving.then(async () => {
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await writeFileAtomically(outputFile, JSON.stringify(report, null, 2) + '\n');
});

try {
  const options = {};
  for (let i = 2; i < process.argv.length; i++) {
    const flag = process.argv[i];
    if (flag === '--help' || flag === '--download-assets' || flag === '--allow-source-fallback') { options[flag] = true; continue; }
    if (!values.has(flag) || !process.argv[i + 1] || process.argv[i + 1].startsWith('--')) throw new TypeError('Invalid latency benchmark option');
    options[flag] = process.argv[++i];
  }
  if (options['--help']) {
    console.log('Use --input <source jobs.json> [--concurrency 1,4,8] [--threads 8] [--target-ms 3000] [--correction-mode adaptive|always] [--allow-source-fallback] [--assets-dir <verified assets>] [--download-assets]. GPU: --gpu-layers all --binary <compatible llama-server> --binary-sha256 <SHA-256>. No MongoDB connection or publication.');
  } else {
    const gpuLayers = rewriteGpuLayers(options['--gpu-layers'] ?? 0);
    if (gpuLayers !== 0 && (!options['--binary'] || !options['--binary-sha256'])) throw new TypeError('GPU benchmarking requires a compatible binary and its SHA-256 checksum');
    if (!options['--input']) throw new TypeError('Use --input with complete source jobs');
    const concurrencies = [...new Set((options['--concurrency'] || '1,4').split(',').map(Number))];
    const correctionMode = options['--correction-mode'] || 'adaptive';
    const allowSourceFallback = Boolean(options['--allow-source-fallback']);
    if (!CORRECTION_MODES.includes(correctionMode)) throw new TypeError('Invalid prose correction mode');
    const threads = Number(options['--threads'] || REWRITE_MODEL.cpuThreads);
    const targetMs = Number(options['--target-ms'] || 3000);
    const budget = Number(options['--budget-seconds'] || 600);
    const port = Number(options['--port'] || 18782);
    if (concurrencies.some(n => !Number.isInteger(n) || n < 1 || n > MAX_REWRITE_CONCURRENCY)
      || !Number.isSafeInteger(threads) || threads < 1 || !Number.isFinite(targetMs) || targetMs <= 0
      || !Number.isFinite(budget) || budget <= 0 || budget * 1000 > 2147483647
      || !Number.isInteger(port) || port < 1024 || port > 65535) throw new TypeError('Invalid latency benchmark limits');
    const jobs = JSON.parse(await fs.readFile(path.resolve(options['--input']), 'utf8'));
    if (!Array.isArray(jobs) || !jobs.length) throw new TypeError('Input must contain complete source jobs');
    outputFile = path.resolve(options['--output'] || '.cache/description-latency/report.json');
    const cacheDir = path.join(path.dirname(outputFile), 'rewrite-cache');
    const deadline = Date.now() + Math.ceil(budget * 1000), controller = new AbortController();
    for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => controller.abort());
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(Math.ceil(budget * 1000))]);
    report = { status: 'running', model: REWRITE_MODEL, policyHash: await rewritePolicyIdentity(),
      targetMs, correctionMode, allowSourceFallback, sourceJobs: jobs.length, startedAt: new Date().toISOString(), nativeInferenceAttempted: false,
      nativeInferenceExecuted: false, nativeGenerationRequests: 0,
      environment: { platform: process.platform, cpu: os.cpus()[0]?.model, availableCpus: os.availableParallelism(),
        requestedThreads: threads, requestedGpuLayers: gpuLayers }, configurations: [],
      measurement: 'Request latency covers generation and validation, excluding result recording; throughput includes result recording. Startup and warmup are separate. Cache replay uses accepted fresh cases; misses remain fresh. Inference execution is null if an attempted warmup fails without observed output. No MongoDB writes.' };
    await save();
    const setup = Date.now();
    const runtime = await prepareRewriteRuntime({ directory: options['--assets-dir'], signal,
      allowDownload: Boolean(options['--download-assets']), binaryOverride: options['--binary'], binarySha256: options['--binary-sha256'] });
    report.assetPreparationMs = Date.now() - setup;
    report.runtime = { kind: runtime.runtimeKind, binarySha256: runtime.binarySha256, archiveSha256: runtime.runtimeArchiveSha256 };
    for (const requestedConcurrency of concurrencies) {
      signal.throwIfAborted();
      const startup = Date.now();
      worker = await startRewriteWorker({ ...runtime, threads, parallelism: requestedConcurrency, gpuLayers, port, signal, deadline,
        logFile: path.join(path.dirname(outputFile), `worker-${requestedConcurrency}.log`) });
      const effective = rewriteWorkerConfiguration({ threads, parallelism: requestedConcurrency, gpuLayers });
      const config = { requestedConcurrency, concurrency: worker.parallelism, cpuThreads: effective.threads,
        contextTokensPerRequest: REWRITE_MODEL.contextTokens, startupMs: Date.now() - startup, phases: [] };
      report.configurations.push(config);
      try {
        const clientOptions = { ...worker, correctionMode, planCacheDir: cacheDir };
        const client = createRewriteClient(clientOptions);
        const warmInput = buildRewriteInput({ title: 'Warmup', sourceDescription: 'Responsibilities:\nBuild reliable Python services and maintain automated tests.' });
        report.nativeInferenceAttempted = true;
        report.nativeInferenceExecuted = report.nativeInferenceExecuted === true ? true : null;
        await measureRewriteWarmup(warmInput, { client, signal, deadline, onResult: async result => {
          config.warmup = result;
          report.nativeGenerationRequests += result.generationRequests || 0;
          if (result.outputReceived && result.generationRequests > 0) report.nativeInferenceExecuted = true;
          await save();
        } });
        const runPhase = async (name, phaseJobs, phaseClient, cacheMode) => {
          const phase = { name, rows: [] };
          config.phases.push(phase);
          const result = await benchmarkRewriteLatency(phaseJobs, { client: phaseClient, concurrency: worker.parallelism,
            cacheMode, targetMs, allowSourceFallback, signal, deadline, onResult: async row => {
              phase.rows.push(row);
              report.nativeGenerationRequests += row.generationRequests;
              if (row.generationRequests > 0 && row.outputReceived) report.nativeInferenceExecuted = true;
              console.log(JSON.stringify({ concurrency: worker.parallelism, phase: name, index: row.index,
                kind: row.kind, accepted: row.accepted, durationMs: row.durationMs }));
              await save();
            } });
          Object.assign(phase, result);
          await save();
          return result;
        };
        const fresh = await runPhase('fresh', jobs, client, 'refresh');
        config.sampleMeetsTarget = fresh.summary.fresh.acceptedUnderTarget === jobs.length;
        const acceptedJobs = fresh.rows.filter(row => row.accepted && !row.quality?.sourceFallbackBlocks).map(row => jobs[row.index - 1]);
        config.cacheEligibleJobs = acceptedJobs.length;
        if (acceptedJobs.length) {
          const cachedClient = createRewriteClient(clientOptions);
          await runPhase('disk-cache', acceptedJobs, cachedClient, 'use');
          await runPhase('memory-cache', acceptedJobs, cachedClient, 'use');
        }
      } finally { await worker.stop(); worker = null; }
    }
    report.status = 'completed';
  }
} catch (error) {
  if (report) {
    report.status = error.code === 'REWRITE_ASSETS_UNAVAILABLE' ? 'blocked' : 'failed';
    report.errorCode = error.code || error.name;
    process.exitCode = report.status === 'blocked' ? 2 : 1;
    console.error(JSON.stringify({ status: report.status, errorCode: report.errorCode, nativeInferenceExecuted: report.nativeInferenceExecuted }));
  } else { console.error(error instanceof TypeError ? error.message : 'Unable to read latency benchmark input'); process.exitCode = 1; }
} finally {
  await worker?.stop();
  if (report) { report.finishedAt = new Date().toISOString(); await save(); }
}
