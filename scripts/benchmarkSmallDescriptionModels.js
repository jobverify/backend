/** Local, unpublished scraper/model experiment. Never calls a MongoDB write API. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { buildScrapers } from '../scraper-support/providers/index.js';
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js';
import { REWRITE_MODEL, buildRewriteInput, validateRewrite } from '../src/services/jobDescriptionPolicy.js';
import { buildSourceEdits } from '../rewriting/editProtocol.js';
import { createRewriteClient, assessDescriptionRewrite, validateDescriptionRewrite, RewriteGenerationError } from '../rewriting/runner.js';
import { factPlanMessages, factPlanSchema, buildSourceFacts, assessRewriteInput, expandModelPlan, validateFactPlan } from '../rewriting/factPlan.js';
import { ensureArtifact, workerMemoryBytes } from '../rewriting/worker.js';
import { writeFileAtomically } from '../rewriting/atomicFile.js';
import { formatEmployerSource } from '../rewriting/sourceOrderFormatter.js';
import { auditDescriptionRun } from '../rewriting/auditDescriptionRun.js';
import { minimalPlanTransport } from '../rewriting/minimalPlanTransport.js';

const exec = promisify(execFile);
const option = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const phase = option('--phase', 'consume');
const runDir = path.resolve(option('--run-dir', '.cache/description-benchmark/first100-liquid'));
const assetDir = path.resolve(option('--asset-dir', '.cache/small-description-model-assets'));
const modelSize = option('--model', '9000');
const grounded = modelSize === '9000';
const slots = Number(option('--slots', '1'));
const threads = Number(option('--threads', '4'));
const workers = Number(option('--workers', '1'));
const totalConcurrency = slots * workers;
const promptCache = process.argv.includes('--prompt-cache');
const minimalPlan = process.argv.includes('--minimal-plan');
const compactPlan = minimalPlan || process.argv.includes('--compact-plan');
const allDescriptions = process.argv.includes('--all-descriptions');
const finalSnapshots = process.argv.includes('--final-snapshots');
const preserveSourceContext = process.argv.includes('--preserve-source-context');
const factOptions = {preserveContext:preserveSourceContext};
const compactPlanGrammar = schema => {
  const items = schema.properties.categories.items;
  const categories = Array.isArray(items) ? items.map(item => '(' + item.enum.map(n => JSON.stringify(String(n))).join(' | ') + ')').join(' "," ') : '';
  const overview = schema.properties.overviewFactId.enum?.map(n => JSON.stringify(String(n))).join(' | ') || '"null"';
  return 'root ::= ' + JSON.stringify('{"categories":[') + ' ' + categories + ' ' + JSON.stringify('],"overviewFactId":') + ' (' + overview + ') "}"\n';
};
const sampleSize = Number(option('--sample', '200'));
const sampleKind = option('--sample-kind', 'lengths');
const consumeLimit = Number(option('--limit', 'Infinity'));
const configs = {
  '9000': { id: REWRITE_MODEL.modelId, revision: REWRITE_MODEL.revision, file: REWRITE_MODEL.file, sha256: REWRITE_MODEL.sha256, bytes: REWRITE_MODEL.bytes },
  '350': { id: 'LiquidAI/LFM2.5-350M-GGUF', revision: '657e078c94084481950a2d555a941481f715536b', file: 'LFM2.5-350M-QAD-Q4_0.gguf', sha256: '3d10b6ab8fc91a919534b9558e266255aca0bbc7f6d015963599aa9e74e05b1d', bytes: 219312832 },
};
const { runtimeTag, runtimeAssets } = REWRITE_MODEL;
if (!['prepare', 'scrape', 'consume', 'evaluate'].includes(phase) || !configs[modelSize] || ![1, 2, 4].includes(slots) || ![1, 2, 4].includes(threads) || ![1, 2, 4].includes(workers) || threads * workers > 4 || totalConcurrency > 4 || !Number.isInteger(sampleSize) || sampleSize < 1 || !(consumeLimit===Infinity||Number.isSafeInteger(consumeLimit)&&consumeLimit>=1) || !['lengths', 'longest'].includes(sampleKind)) throw new Error('Invalid benchmark options');
await fs.mkdir(runDir, { recursive: true });
const log = value => console.log(JSON.stringify(value));
const save = (file, value) => writeFileAtomically(file, JSON.stringify(value, null, 2) + '\n');
const controller = new AbortController();
for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => controller.abort(new Error(event)));
const signal = controller.signal;

if (phase === 'prepare') {
  const artifact = runtimeAssets[process.platform];
  if (!artifact || process.arch !== 'x64') throw new Error('CPU benchmark supports Windows/Linux x64');
  await fs.mkdir(assetDir, { recursive: true });
  await save(path.join(assetDir, 'benchmark-models.json'), { models: configs, runtimeTag, runtimeAssets });
  await Promise.all([
    ...Object.values(configs).map(m => ({ ...m, url: 'https://huggingface.co/' + m.id + '/resolve/' + m.revision + '/' + m.file })),
    { ...artifact, url: 'https://github.com/ggml-org/llama.cpp/releases/download/' + runtimeTag + '/' + artifact.file },
  ].map(async a => { const start = Date.now(); await ensureArtifact({ ...a, file: path.join(assetDir, a.file), signal }); log({ event: 'artifact-verified', file: a.file, seconds: (Date.now() - start) / 1000 }); }));
  const runtimeDir = path.join(assetDir, 'runtime-' + process.platform);
  await fs.mkdir(runtimeDir, { recursive: true });
  if (process.platform === 'win32') await exec('powershell.exe', ['-NoProfile', '-Command', "Expand-Archive -LiteralPath '" + path.join(assetDir, artifact.file).replaceAll("'", "''") + "' -DestinationPath '" + runtimeDir.replaceAll("'", "''") + "' -Force"], { windowsHide: true });
  else await exec('tar', ['-xzf', path.join(assetDir, artifact.file), '-C', runtimeDir]);
  log({ status: 'prepared', assetDir });
} else if (phase === 'scrape') {
  // The runner captures --dry-run at module import, so establish it before importing.
  if (!process.argv.includes('--dry-run')) process.argv.push('--dry-run');
  Object.assign(process.env, {
    MONGO_URI: '', JOB_DESCRIPTION_REWRITE_MODE: 'off', TELEGRAM_ENABLED: 'false',
    SCRAPER_RAW_CAPTURE_DIRECTORY: path.join(runDir, 'raw-captures'),
    SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY: path.join(runDir, 'outbox'),
    SCRAPER_DISABLE_DRY_RUN_PUBLIC_EXPERIENCE: '1', SCRAPER_SOURCE_TIMEOUT_MS: '600000',
    WORKDAY_SCRAPER_TIMEOUT_MS: '600000', WORKDAY_REQUEST_TIMEOUT_MS: '20000',
    WORKDAY_DETAIL_FETCH_CONCURRENCY: '1', WORKDAY_DETAIL_ENRICHMENT_BUDGET_MS: '480000',
  });
  const { runScraper, withSourceLifecycleTimeout } = await import('../scraper-support/runner.js');
  const catalog = buildScrapers().slice(0, 100);
  const scrapeFile = path.join(runDir, 'scrape-summary.json');
  const concurrency = Number(option('--scraper-concurrency', '6'));
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) throw new Error('Invalid scraper concurrency');
  try { await fs.access(scrapeFile); throw new Error('Use a fresh scrape directory'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const report = { status: 'running', startedAt: new Date().toISOString(), mongoWrites: 0, concurrency,
    selectedSources: catalog.map((s, i) => ({ index: i + 1, source: s.name, company: s.provider.companyName, adapter: s.provider.adapter })), sources: {} };
  await save(scrapeFile, report);
  const queue = catalog.map((s, i) => ({ ...s, index: i + 1, dryRunFile: path.join(runDir, 'snapshots', s.name + '.json') }));
  let saving = Promise.resolve();
  const saveProgress = () => { saving = saving.then(() => save(scrapeFile, report)); return saving; };
  await fs.mkdir(path.join(runDir, 'snapshots'), { recursive: true });
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length && !signal.aborted) {
      const scraper = queue.shift(), start = Date.now();
      let result;
      try { result = await withSourceLifecycleTimeout(scraper, options => runScraper(scraper, '[' + scraper.index + '/100] ', options), 600000, { signal, abortGraceMs: 10000 }); }
      catch (e) { result = { source: scraper.name, success: false, errorType: e.name, error: e.message, durationMs: Date.now() - start }; }
      report.sources[scraper.name] = { ...result, index: scraper.index, finishedAt: new Date().toISOString() };
      await saveProgress();
      log({ event: 'source-finished', source: scraper.name, complete: Object.keys(report.sources).length, jobs: result.jobs || 0, success: result.success, seconds: (Date.now() - start) / 1000 });
    }
  }));
  report.status = signal.aborted ? 'interrupted' : 'complete'; report.finishedAt = new Date().toISOString();
  report.summary = { completedSources: Object.keys(report.sources).length, successfulSources: Object.values(report.sources).filter(s => s.success).length, failedSources: Object.values(report.sources).filter(s => !s.success).length,
    indiaJobs: Object.values(report.sources).reduce((n, s) => n + (s.jobs || 0), 0), durationSeconds: (Date.now() - Date.parse(report.startedAt)) / 1000 };
  await saveProgress(); log({ status: report.status, ...report.summary, mongoWrites: 0 });
} else {
  const config = configs[modelSize], mode = (phase === 'consume' ? 'arrival' : 'sample')+(minimalPlan?'-minimal':'');
  const label = option('--label', '');
  if (label && !/^[a-z0-9-]+$/i.test(label)) throw new Error('Invalid benchmark label');
  const outputDir = path.join(runDir, modelSize + 'm-t' + threads + '-slots' + slots + (workers > 1 ? '-workers' + workers : '') + '-' + mode + (label ? '-' + label : ''));
  await fs.mkdir(path.join(outputDir, 'cases'), { recursive: true });
  const summaryFile = path.join(outputDir, 'summary.json');
  try { await fs.access(summaryFile); throw new Error('Benchmark output already exists; preserve it and choose another configuration/run directory'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const report = { status: 'starting', startedAt: new Date().toISOString(), model: config, runtimeTag,
    environment: { platform: process.platform, node: process.version, cpu: os.cpus()[0]?.model, hostLogicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(), threads, slots, workers, totalModelThreads: threads * workers, totalConcurrency, contextTokensPerSlot: 8192 },
    policy: (grounded ? REWRITE_MODEL.policyVersion + '; production ' + REWRITE_MODEL.outputFormat : 'historical fact-plan-v11; quoted source preserved') + '; prompt cache ' + (promptCache ? 'enabled with bounded RAM' : 'disabled') + '; compact JSON grammar ' + (!grounded && compactPlan), mongoWrites: 0, seenBatches: [], results: [] };
  report.policy += '; preserveSourceContext='+preserveSourceContext+'; allDescriptions='+allDescriptions+'; minimalNumericTransport='+minimalPlan;
  // Keep large-run checkpoints small. Detailed results and source/draft pairs
  // are durably appended per job; repeatedly rewriting every row is quadratic.
  const saveReport = () => save(summaryFile, allDescriptions ? {...report,resultsCount:report.results.length,results:report.results.slice(-20)} : report);
  await saveReport();
  const findServer = async dir => { for (const item of await fs.readdir(dir, { withFileTypes: true })) { const file = path.join(dir, item.name); if (item.isFile() && item.name === (process.platform === 'win32' ? 'llama-server.exe' : 'llama-server')) return file; if (item.isDirectory()) { const found = await findServer(file); if (found) return found; } } return null; };
  const binary = await findServer(path.join(assetDir, 'runtime-' + process.platform));
  if (!binary) throw new Error('Run --phase prepare first');
  const port = Number(option('--port', '18772'));
  const modelAlias = 'benchmark-description-' + modelSize;
  const setupAt = Date.now();
  const servers = [];
  for (let i = 0; i < workers; i++) {
    const logHandle = await fs.open(path.join(outputDir, workers === 1 ? 'worker.log' : 'worker-' + i + '.log'), 'w');
    const worker = spawn(binary, ['-m', path.join(assetDir, config.file), '--alias', modelAlias,
      '--host', '127.0.0.1', '--port', String(port + i), '-c', String(8192 * slots), '-np', String(slots),
      '-t', String(threads), '-tb', String(threads), '-ngl', '0', '--jinja', '--no-context-shift', '--no-webui',
      ...(grounded ? ['--chat-template-kwargs', '{"enable_thinking":false}', '--reasoning', 'off', '--no-reasoning-preserve'] : []),
      '--cache-ram', '128', ...(promptCache ? ['--ubatch-size', '256', '--checkpoint-min-step', '128'] : [])],
      { cwd: path.dirname(binary), windowsHide: true, stdio: ['ignore', logHandle.fd, logHandle.fd], env: { ...process.env, LD_LIBRARY_PATH: path.dirname(binary) + path.delimiter + (process.env.LD_LIBRARY_PATH || '') } });
    await logHandle.close();
    const server = { worker, endpoint: 'http://127.0.0.1:' + (port + i), exited: false, error: null, ready: false, peakMemoryBytes: 0 };
    worker.on('error', e => { server.error = e; });
    server.exit = new Promise(resolve => worker.once('exit', () => { server.exited = true; resolve(); }));
    servers.push(server);
  }
  const assertWorkers = () => { for (const server of servers) if (server.error || server.exited) throw server.error || new Error('Model worker exited unexpectedly; see worker log'); };
  const clients = grounded ? servers.map(server => createRewriteClient({ endpoint: server.endpoint, model: modelAlias, assertAlive: assertWorkers })) : [];
  let memoryTimer, memoryBusy = false;
  const memorySample = async () => { if (memoryBusy) return; memoryBusy = true; try {
    report.peakCoordinatorMemoryBytes = Math.max(report.peakCoordinatorMemoryBytes || 0, process.memoryUsage().rss);
    await Promise.all(servers.filter(s => !s.exited).map(async s => { s.peakMemoryBytes = Math.max(s.peakMemoryBytes, await workerMemoryBytes(s.worker.pid) || 0); }));
    report.peakWorkerMemoryBytes = servers.reduce((n, s) => n + s.peakMemoryBytes, 0);
    report.workerPeakMemoryBytes = servers.map(s => s.peakMemoryBytes);
  } catch {} finally { memoryBusy = false; } };
  const seen = new Set(), batches = new Set(), pending = [];
  const inputDirectory=path.join(runDir,finalSnapshots?'snapshots':'outbox');
  let finalInputFiles;
  const inputFiles=async()=>finalInputFiles||((await fs.readdir(inputDirectory)).filter(f=>f.endsWith(finalSnapshots?'.json':'.jobs.json')).sort());
  if(finalSnapshots){finalInputFiles=await inputFiles();report.inputMode='immutable_final_snapshots';report.capturedRows=0;report.duplicateRows=0;}
  const preprocessingStarted = Date.now();
  let preprocessingMs = 0;
  let discovered = 0, firstRequestAt = null, lastCompletionAt = null;
  const readBatches = async ({ maxBatches = Infinity } = {}) => {
    const readStarted = Date.now();
    let readCount = 0;
    let files; try { files = await inputFiles(); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    for (const file of files) {
      if (batches.has(file)) continue;
      const data=JSON.parse(await fs.readFile(path.join(inputDirectory, file), 'utf8'));
      const batch=finalSnapshots?{source:file.slice(0,-5),jobs:data,phase:'final_snapshot'}:data;
      if (!Array.isArray(batch.jobs) || !reportModelSources.has(batch.source)) throw new Error('Unexpected benchmark batch: '+file+' source='+batch.source);
      if(finalSnapshots)report.capturedRows+=batch.jobs.length;
      for (const job of batch.jobs) {
        // Final snapshots already passed scraper normalization. Repeating its
        // signal extraction increases both latency and peak memory.
        const normalized = finalSnapshots?job:normalizeScrapedJob(job, { source: batch.source });
        const input = buildRewriteInput(normalized);
        const key = createHash('sha256').update(batch.source + '|' + (job.sourceUrl || job.applyUrl || job.link || job.jobId || job.title) + '|' + input.inputHash).digest('hex');
        if (seen.has(key)) {if(finalSnapshots)report.duplicateRows++;continue;}
        seen.add(key); discovered++;
        pending.push({ key, index: discovered, source: batch.source, job: normalized, input, availableAt: batch.availableAt, phase: batch.phase });
        if (discovered % 25 === 0) await delay(0, undefined, { signal });
      }
      batches.add(file); report.seenBatches.push(file);
      if (++readCount >= maxBatches) break;
    }
    preprocessingMs += Date.now() - readStarted;
  };
  const scope = JSON.parse(await fs.readFile(path.join(runDir, 'scrape-summary.json'), 'utf8'));
  const reportModelSources = new Set(scope.selectedSources.map(s => s.source));
  const loadFixedInputs = async () => {
    if (scope.status !== 'complete') { await readBatches(); return; }
    const files = await inputFiles();
    const policyFiles = ['../scraper-support/utils/normalizeScrapedJob.js', '../src/services/jobDescriptionPolicy.js', '../src/utils/jobSourceContent.js'];
    const fingerprint = createHash('sha256').update(JSON.stringify(files));
    for (const file of policyFiles) fingerprint.update(await fs.readFile(new URL(file, import.meta.url)));
    const cacheFile = path.join(runDir, 'fixed-inputs-' + fingerprint.digest('hex').slice(0, 16) + '.json');
    const cacheStarted = Date.now();
    try {
      const cached = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
      if (JSON.stringify(cached.batches) !== JSON.stringify(files) || !Array.isArray(cached.inputs)) throw new Error('Input cache manifest mismatch');
      pending.push(...cached.inputs); discovered = cached.inputs.length;
      for (const file of files) { batches.add(file); report.seenBatches.push(file); }
      report.inputCache = { hit: true, file: path.basename(cacheFile), jobs: discovered };
      preprocessingMs += Date.now() - cacheStarted;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      await readBatches();
      await save(cacheFile, { batches: files, inputs: pending });
      report.inputCache = { hit: false, file: path.basename(cacheFile), jobs: discovered };
    }
  };
  const request = async (item, workerIndex = 0) => {
    const { input } = item, assessment = grounded ? assessDescriptionRewrite(input) : assessRewriteInput(input,factOptions), facts = buildSourceFacts(input,factOptions);
    const protocol = grounded ? REWRITE_MODEL.outputFormat === 'fact-plan'
      ? { schema: factPlanSchema(input), messages: factPlanMessages(input) } : buildSourceEdits(input) : null;
    const schema = grounded ? protocol.schema : factPlanSchema(input,factOptions), originalMessages = grounded ? protocol.messages : factPlanMessages(input,factOptions);
    const transport=!grounded&&minimalPlan?minimalPlanTransport(schema,originalMessages):null,messages=transport?.messages||originalMessages;
    const formatted = allDescriptions ? formatEmployerSource(input.sourceDescription) : null;
    const row = { key: item.key, index: item.index, source: item.source, title: item.job.title, url: item.job.sourceUrl || item.job.applyUrl || item.job.link,
      availableAt: item.availableAt, startedAt: new Date().toISOString(), sourceWords: input.sourceWords, sourceBytes: Buffer.byteLength(input.sourceDescription), sourceFacts: facts.length,
      ambiguousFacts: schema.properties.categories?.minItems || 0, assessment: assessment.ok ? 'eligible' : assessment.reason,
      requestSignature: createHash('sha256').update(JSON.stringify([messages, schema])).digest('hex'), workerIndex, attempted: false,
      ...(formatted?{sourceAvailable:formatted.sourceAvailable,sourcePayloadPreserved:formatted.preserved,headings:formatted.headingCount,bullets:formatted.bulletCount}:{}),
      ...(preserveSourceContext?{requiredFacts:facts.filter(f=>[2,3].includes(f.section)).length,preferredFacts:facts.filter(f=>f.section===4).length}:{}),
    };
    const started = Date.now();
    let validation = assessment, response, rawPlan, completionContent;
    const forceProbe = phase === 'evaluate' && (process.argv.includes('--probe-large') && input.sourceWords >= 25 || process.argv.includes('--probe-skips') && input.eligible && facts.length > 0 && facts.length <= 128);
    try {
      const withinModelBudget=grounded ? input.eligible : Buffer.byteLength(JSON.stringify(messages))<=12000&&schema.properties.categories.minItems<=200;
      if (assessment.ok || forceProbe || allDescriptions&&formatted.sourceAvailable&&withinModelBudget) {
        row.attempted = true; firstRequestAt ??= started;
        if (grounded) {
          response = await clients[workerIndex].generate(input, { signal });
          rawPlan = response.value; completionContent = JSON.stringify(response.rawValue);
          validation = validateDescriptionRewrite(response.value, input, response.finishReason, response.format);
          row.finishReason = response.finishReason; row.usage = response.usage; row.timings = response.timings;
          row.generationRequests = response.generationRequests; row.modelPlanCached = !!response.cachedModelPlan;
        } else {
        const timeout = AbortSignal.timeout(180000);
        const requestOptions = { method: 'POST', signal: AbortSignal.any([signal, timeout]), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelAlias,
          messages, ...(compactPlan ? { grammar: transport?.grammar||compactPlanGrammar(schema) } : { response_format: { type: 'json_schema', json_schema: { name: 'job_description', strict: true, schema } } }),
          temperature: 0.1, top_k: 50, repeat_penalty: 1.05, seed: 42, max_tokens: 768, stream: false, cache_prompt: promptCache }) };
        let res;
        for (let networkAttempt = 0; networkAttempt < 2; networkAttempt++) {
          try { res = await fetch(servers[workerIndex].endpoint + '/v1/chat/completions', requestOptions); break; }
          catch (e) { if (networkAttempt || e.name !== 'TypeError' || requestOptions.signal.aborted) throw e; row.networkRetries = 1; await delay(20, undefined, { signal }); }
        }
        if (!res.ok) throw new Error('Inference HTTP ' + res.status);
        response = await res.json(); const choice = response.choices?.[0];
        completionContent = choice?.message?.content || 'null';
        rawPlan = minimalPlan?transport.decode(JSON.parse(completionContent)):JSON.parse(completionContent);
        validation = validateFactPlan(expandModelPlan(rawPlan, input,factOptions), input, choice?.finish_reason,factOptions);
        row.finishReason = choice?.finish_reason; row.usage = response.usage; row.timings = response.timings;
        }
      } else if(allDescriptions) validation={ok:false,reason:formatted.sourceAvailable?'model_context_budget':'empty_source'};
    } catch (e) {
      if(grounded && !(e instanceof RewriteGenerationError) && !['TimeoutError','AbortError'].includes(e.name))throw e;
      if(Number.isInteger(e.generationRequests))row.generationRequests=e.generationRequests;
      validation = { ok: false, reason: e.reason==='model_context_budget'?'model_context_budget':e.name === 'TimeoutError' ? 'timeout' : 'generation_error' };
      row.errorType = e.name; row.error = e.message; row.errorCode = e.cause?.code;
    }
    row.durationMs = Date.now() - started; row.accepted = validation.ok; row.reason = validation.reason || null; row.quality = validation.quality;
    lastCompletionAt = Date.now();
    const outputDescription=validation.ok?validation.description:allDescriptions&&formatted?.sourceAvailable&&formatted.preserved?formatted.description:null;
    row.outputMethod=validation.ok?(grounded?'validated_source_grounded_sections':'validated_model_plan'):allDescriptions?'source_order_formatter_fallback':'no_draft';
    row.formatted=!!outputDescription;
    row.outputPreservationCheck=validation.ok?(grounded?'source_evidence_numbers_negation_qualification_scope':'locked_original_source_facts'):formatted?.preserved?'normalized_source_payload':'failed';
    await save(path.join(outputDir, 'cases', String(row.index).padStart(6, '0') + '-' + row.key.slice(0, 12) + '.json'), { ...row, originalDescription: input.sourceDescription,
      description:outputDescription,
      modelSuggestedDescription:allDescriptions?validation.description||null:undefined,
      sourceSectionFacts:preserveSourceContext?facts.map(f=>({text:f.text,section:f.section})):undefined,
      rawPlan, completionContent, job: item.job });
    if(allDescriptions)await fs.appendFile(path.join(outputDir,'descriptions.ndjson'),JSON.stringify({key:row.key,source:row.source,title:row.title,url:row.url,method:row.outputMethod,preservationCheck:row.outputPreservationCheck,description:outputDescription})+'\n');
    report.results.push(row);
    await fs.appendFile(path.join(outputDir, 'results.ndjson'), JSON.stringify(row) + '\n');
    if (report.results.length % 25 === 0 || row.error) { await saveReport(); log({ event: 'model-progress', model: modelSize, slots, reviewed: report.results.length, attempted: report.results.filter(r => r.attempted).length, accepted: report.results.filter(r => r.accepted).length, pending: pending.length, source: row.source, words: row.sourceWords, seconds: row.durationMs / 1000, reason: row.reason }); }
    return row;
  };
  try {
    const startupEnd = Date.now() + 120000;
    let ready = false;
    while (Date.now() < startupEnd && !ready) {
      signal.throwIfAborted(); assertWorkers();
      await Promise.all(servers.filter(s => !s.ready).map(async s => { try { const r = await fetch(s.endpoint + '/v1/models', { signal: AbortSignal.timeout(1000) }); s.ready = r.ok && (await r.json()).data?.some(m => m.id === modelAlias); } catch {} }));
      ready = servers.every(s => s.ready);
      if (!ready) await delay(200, undefined, { signal });
    }
    if (!ready) throw new Error('Model readiness timeout');
    report.setupMs = Date.now() - setupAt; report.workerPids = servers.map(s => s.worker.pid); report.ownerPid = process.pid; report.status = 'running';
    await memorySample(); memoryTimer = setInterval(() => { void memorySample(); }, 10000);
    await saveReport();
    log({ event: 'model-ready', model: modelSize, slots, threads, workers, setupSeconds: report.setupMs / 1000 });
    if (phase === 'evaluate') {
      await loadFixedInputs();
      let selectionIndex;
      try {
        const index = JSON.parse(await fs.readFile(path.join(runDir, 'analysis', 'candidate-index.json'), 'utf8'));
        const hash = createHash('sha256');
        for (const file of ['../rewriting/factPlan.js', '../src/services/jobDescriptionPolicy.js']) hash.update(await fs.readFile(new URL(file, import.meta.url)));
        hash.update(JSON.stringify(factOptions));
        if (index.policyHash === hash.digest('hex') && index.inputFile === report.inputCache?.file && index.inputs.length === pending.length) {
          const mapped = new Map(index.inputs.map(i => [i.key, i]));
          if (pending.every(i => mapped.has(i.key))) selectionIndex = mapped;
        }
      } catch (e) { if (e.code !== 'ENOENT') throw e; }
      report.selectionCacheHit = !!selectionIndex;
      const candidates = pending.filter(item => {
        const prior = selectionIndex?.get(item.key), eligible = prior ? prior.policyAssessment === 'eligible' : (grounded ? assessDescriptionRewrite(item.input) : assessRewriteInput(item.input,factOptions)).ok;
        return eligible || process.argv.includes('--probe-large') && item.input.sourceWords >= 25 || process.argv.includes('--probe-skips') && item.input.eligible && (prior?.sourceFacts ?? buildSourceFacts(item.input,factOptions).length) <= 128;
      });
      candidates.sort((a, b) => a.input.sourceWords - b.input.sourceWords || a.key.localeCompare(b.key));
      const selected = sampleKind === 'longest' ? candidates.slice(-sampleSize) : Array.from({ length: Math.min(sampleSize, candidates.length) }, (_, i) => candidates[Math.min(candidates.length - 1, Math.floor(i * candidates.length / Math.min(sampleSize, candidates.length)))]);
      report.sample = { kind: sampleKind, availableCandidates: candidates.length, selected: selected.length, method: (sampleKind === 'longest' ? 'largest source descriptions; stress test, not a workload estimate' : 'evenly spaced across source-word distribution') + '; fixed immutable inputs; no output cache; prompt caching ' + promptCache };
      const tasks = [...selected]; const waveStarted = Date.now();
      await Promise.all(Array.from({ length: totalConcurrency }, async (_, slotIndex) => { while (tasks.length && !signal.aborted) await request(tasks.shift(), Math.floor(slotIndex / slots)); }));
      report.sample.wallSeconds = (Date.now() - waveStarted) / 1000;
    } else {
      if (process.argv.includes('--use-fixed-inputs')) await loadFixedInputs();
      const inFlight = new Set();
      const workerBusy = servers.map(() => 0);
      while (!signal.aborted) {
        assertWorkers();
        try { await fs.access(path.join(outputDir, 'stop-request')); report.stopReason = 'benchmark_stop_request'; break; } catch (e) { if (e.code !== 'ENOENT') throw e; }
        if (report.results.length >= consumeLimit) { report.stopReason = 'benchmark_sample_limit'; break; }
        if(pending.length<totalConcurrency)await readBatches({ maxBatches: 1 });
        while (pending.length && inFlight.size < totalConcurrency && report.results.length + inFlight.size < consumeLimit) {
          const workerIndex = workerBusy.findIndex(n => n < slots);
          workerBusy[workerIndex]++;
          const task = request(pending.shift(), workerIndex);
          inFlight.add(task);
          task.finally(() => { inFlight.delete(task); workerBusy[workerIndex]--; });
        }
        if (pending.length && inFlight.size) { await Promise.race(inFlight); continue; }
        const scrape = JSON.parse(await fs.readFile(path.join(runDir, 'scrape-summary.json'), 'utf8'));
        if (scrape.status !== 'running') { if(!pending.length)await readBatches({ maxBatches: 1 }); if (!pending.length && !inFlight.size && batches.size === (await inputFiles()).length) break; }
        if(finalSnapshots&&!pending.length&&!inFlight.size)continue;
        if (inFlight.size) await Promise.race([...inFlight, delay(500, undefined, { signal })]);
        else await delay(500, undefined, { signal });
      }
      await Promise.all(inFlight);
    }
    report.status = signal.aborted || report.stopReason ? 'interrupted' : 'complete';
  } catch (e) { report.status = 'error'; report.error = { type: e.name, message: e.message }; process.exitCode = 1; }
  finally {
    if (memoryTimer) clearInterval(memoryTimer); await memorySample();
    for (const s of servers) if (!s.exited && s.worker.pid) s.worker.kill();
    await Promise.race([Promise.all(servers.map(s => s.exit)), delay(5000)]);
    for (const s of servers) if (!s.exited && s.worker.pid) s.worker.kill('SIGKILL');
    report.finishedAt = new Date().toISOString();
    report.preprocessingMs = preprocessingMs;
    report.consumerWallSeconds = (Date.now() - preprocessingStarted) / 1000;
    report.discoveredJobs = discovered;
    const rows = report.results, attempted = rows.filter(r => r.attempted);
    const durations = attempted.map(r => r.durationMs).sort((a, b) => a - b);
    const quantile = (values, p) => values.length ? values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))] : null;
    const sumMs = durations.reduce((n, v) => n + v, 0);
    const inferenceWallSeconds = report.sample?.wallSeconds ?? (totalConcurrency === 1 ? sumMs / 1000 : firstRequestAt && lastCompletionAt ? (lastCompletionAt - firstRequestAt) / 1000 : 0);
    const reasonCounts = {}; for (const r of rows) if (r.reason) reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
    const lengthBuckets = [[0, 250], [250, 500], [500, 1000], [1000, Infinity]].map(([low, high]) => { const group = attempted.filter(r => r.sourceWords >= low && r.sourceWords < high); const d = group.map(r => r.durationMs).sort((a, b) => a - b); return { words: low + '-' + (high === Infinity ? 'plus' : high - 1), attempted: group.length, accepted: group.filter(r => r.accepted).length, meanMs: d.length ? d.reduce((n, v) => n + v, 0) / d.length : null, p50Ms: quantile(d, 0.5), p95Ms: quantile(d, 0.95) }; });
    const modelRequests=rows.reduce((total,row)=>total+(row.generationRequests??(row.attempted?1:0)),0);
    report.summary = { reviewed: rows.length, modelRequests, accepted: rows.filter(r => r.accepted).length, preflightSkipped: rows.filter(r => !r.attempted||r.reason==='model_context_budget').length,
      reasonCounts, uniqueRequestSignatures: new Set(attempted.map(r => r.requestSignature)).size, summedRequestSeconds: sumMs / 1000, inferenceWallSeconds,
      meanRequestMs: durations.length ? sumMs / durations.length : null, p50RequestMs: quantile(durations, 0.5), p95RequestMs: quantile(durations, 0.95), maxRequestMs: durations.at(-1) ?? null,
      requestsPerSecond: inferenceWallSeconds ? modelRequests / inferenceWallSeconds : 0,
      extrapolated35000ModelHours: attempted.length ? 35000 * inferenceWallSeconds / attempted.length / 3600 : null,
      lengthBuckets, caveat: 'Local shared Windows host unless environment.platform says otherwise; source skips, model errors and accepted outputs are separate; no DB write timing; extrapolations are not Linux Actions benchmarks.' };
    report.summary.formatted=rows.filter(r=>r.formatted).length;
    report.summary.fallbackPayloadPreserved=rows.filter(r=>r.outputMethod==='source_order_formatter_fallback'&&r.sourcePayloadPreserved).length;
    report.summary.missingSource=rows.filter(r=>r.sourceAvailable===false).length;
    report.summary.modelOrganized=rows.filter(r=>['validated_model_plan','validated_source_grounded_sections'].includes(r.outputMethod)).length;
    report.summary.sourceFallback=rows.filter(r=>r.outputMethod==='source_order_formatter_fallback'&&r.formatted).length;
    report.summary.outputMethod=grounded?'validated source-grounded model sections; source-order fallback reported separately':allDescriptions?'validated model section plans; source-order formatting for rejected plans (reported separately)':'validated_model_plan';
    if(allDescriptions&&report.status==='complete') {
      log({event:'quality-audit-start',jobs:rows.length});
      report.qualityAudit=await auditDescriptionRun(outputDir);
      if(report.qualityAudit.failed){report.status='needs_review';process.exitCode=1;}
    }
    await saveReport(); log({ status: report.status, model: modelSize, slots, ...report.summary, peakWorkerMemoryMiB: report.peakWorkerMemoryBytes / 2 ** 20 });
  }
}
