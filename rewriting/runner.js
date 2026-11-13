import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { factPlanMessages, factPlanSchema, factPlanRanges, validateFactPlan, assessRewriteInput, expandModelPlan } from './factPlan.js';
import { REWRITE_MODEL, REWRITE_SCHEMA, MAX_REWRITE_SECTION_ITEMS, buildRewriteInput, rewriteMessages, validateRewrite } from '../src/services/jobDescriptionPolicy.js';
import { reconcileRewriteCandidate, rewriteSnapshotFilter, sourceCopyRetryQuery } from './queue.js';
import { RewriteWorkerError, MAX_REWRITE_CONCURRENCY } from './worker.js';
import { captureRewriteError } from './failureDiagnostics.js';
import { buildReferencedSections, expandReferencedSections } from './sectionProtocol.js';
import { buildSourceEdits, expandSourceEdits } from './editProtocol.js';
import { createProseRewriteClient, validateProseRewrite } from './prose.js';
import { rewriteShardFilter } from './partitioning.js';

export const rewriteDeadline = ({ now = Date.now(), budgetSeconds = 1200, workflowStartedAt, workflowSeconds = 9000, cleanupSeconds = 120 } = {}) => {
  const budget = Number(budgetSeconds);
  if (!Number.isFinite(budget) || budget < 0) throw new Error('Rewrite budget must be a nonnegative number');
  if (![Number(workflowSeconds), Number(cleanupSeconds), Number(now)].every(Number.isFinite)) throw new Error('Invalid workflow deadline');
  if (workflowStartedAt && !Number.isFinite(Date.parse(workflowStartedAt))) throw new Error('Invalid workflow start timestamp');
  const started = Date.parse(workflowStartedAt);
  return Math.min(now + budget * 1000, Number.isFinite(started) ? started + Number(workflowSeconds) * 1000 - cleanupSeconds * 1000 : Infinity);
};

export class RewriteGenerationError extends Error {
  constructor(message, options) { super(message, options); this.name = 'RewriteGenerationError'; }
}

export const rewriteStopDetails = ({ budgetExpired = false, cancelled = false } = {}) => cancelled
  ? { interrupted: true, cancelled: true, stopReason: 'cancelled', reason: 'interrupted' }
  : budgetExpired ? { interrupted: true, budgetExhausted: true, stopReason: 'budget_exhausted', reason: 'workflow_budget_exhausted' } : {};

// Apply source-quality checks before choosing a generation protocol.
export const assessDescriptionRewrite = (input, format = REWRITE_MODEL.outputFormat) => {
  if (input.sourceQuality?.ok === false) return { ok: false, reason: input.sourceQuality.reason };
  if (format === 'prose') return input.eligible ? { ok: true } : { ok: false, reason: 'insufficient_source' };
  if (['source-edits', 'source-sections'].includes(format)) {
    if (!input.eligible) return { ok: false, reason: 'insufficient_source' };
    const counts = new Map();
    for (const unit of buildReferencedSections(input).sources.filter(unit => unit.automatic)) {
      const section = unit.section || 'overview'; counts.set(section, (counts.get(section) || 0) + 1);
    }
    return [...counts.values()].some(count => count > MAX_REWRITE_SECTION_ITEMS) ? { ok: false, reason: 'too_many_source_facts' } : { ok: true };
  }
  const assessment = assessRewriteInput(input);
  if (format === 'sections' && ['mixed_requirement_scope', 'dense_source', 'already_structured',
    'too_many_source_facts', 'model_context_budget'].includes(assessment.reason)) return { ok: true };
  return assessment;
};
export const validateDescriptionRewrite = (value, input, finishReason, format) =>
  format === 'prose' ? validateProseRewrite(value, input, finishReason) : format === 'fact-plan' || (!format && value && Object.hasOwn(value, 'categories'))
    ? validateFactPlan(value, input, finishReason) : validateRewrite(value, input, finishReason);

/** Read SSE incrementally; a closed socket without a finish frame is not a completion. */
const readCompletionStream = async (response, { maxCharacters = 100000, repetitionSource, onProgress } = {}) => {
  if (!response.body || typeof response.body[Symbol.asyncIterator] !== 'function') throw new RewriteGenerationError('Local generator stream missing');
  const decoder=new TextDecoder();let buffer='',content='',finishReason=null,done=false,usage,timings,nextRepetitionCheck=1024;
  const repetitionBudget = typeof repetitionSource === 'string' ? JSON.stringify(repetitionSource).length + 512 : Infinity;
  const frame=line=>{
    if(!line.startsWith('data:'))return;
    const data=line.slice(5).trim();if(!data)return;
    if(data==='[DONE]'){done=true;return;}
    let value;try{value=JSON.parse(data);}catch{throw new RewriteGenerationError('Malformed generator stream');}
    if(!value||typeof value!=='object'||Array.isArray(value))throw new RewriteGenerationError('Malformed generator stream');
    if(value.error)throw new RewriteGenerationError('Local generator stream error');
    const choice=value.choices?.[0];
    if(typeof choice?.delta?.content==='string')content+=choice.delta.content;
    onProgress?.(content.slice(0,2400));
    if(content.length>maxCharacters)throw new RewriteGenerationError('Malformed oversized generator stream');
    // Only stop an unsupported repeated run, never ordinary long output. The
    // allowance derives from this source chunk, so repeated employer text fits.
    if(repetitionBudget<16384 && content.length>=nextRepetitionCheck){
      nextRepetitionCheck=content.length+512;
      const tail=content.slice(-Math.max(2048,repetitionBudget+512)).replace(/["}\s]+$/,'');
      const repeated=tail.match(/(.{32,256}?)\1{3,}$/s);
      if(repeated && repeated[0].length>repetitionBudget)throw Object.assign(new RewriteGenerationError('Repetitive generator output'),{reason:'repetitive_output'});
    }
    if(choice?.finish_reason)finishReason=choice.finish_reason;
    usage=value.usage||usage;timings=value.timings||timings;
  };
  try {
  for await(const chunk of response.body){
    buffer+=decoder.decode(chunk,{stream:true});
    let end;while((end=buffer.indexOf('\n'))>=0){frame(buffer.slice(0,end).replace(/\r$/,''));buffer=buffer.slice(end+1);}
    if(buffer.length>maxCharacters)throw new RewriteGenerationError('Malformed oversized generator frame');
  }
  buffer+=decoder.decode();if(buffer.trim())frame(buffer.replace(/\r$/,''));
  if(!done||!finishReason)throw new RewriteGenerationError('Local generator stream incomplete');
  return {choices:[{message:{content},finish_reason:finishReason}],usage,timings};
  } catch (error) {
    error.rawText = content.slice(0, 2400);
    throw error;
  }
};

export const createRewriteClient = ({ endpoint = 'http://127.0.0.1:8766', model = 'job-description-lfm',
  format = REWRITE_MODEL.outputFormat, requestMs, planCacheDir, correctionMode = 'adaptive', assertAlive = () => {} } = {}) => {
  if (!['prose', 'source-edits', 'source-sections', 'sections', 'fact-plan'].includes(format)) throw new Error('Invalid rewrite output format');
  const url = new URL(endpoint);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Generation must run on unauthenticated http://127.0.0.1');
  if (format === 'prose') return createProseRewriteClient({ endpoint, model, requestMs, planCacheDir, correctionMode, assertAlive, GenerationError: RewriteGenerationError,
    readCompletion: (response, source, onProgress) => readCompletionStream(response, { maxCharacters: Infinity, repetitionSource: source, onProgress }) });
  requestMs ??= REWRITE_MODEL.requestSeconds * 1000;
  const cache = new Map();
  const compact = format === 'fact-plan', boundedEdits = format === 'source-edits', referenced = boundedEdits || format === 'source-sections';
  const cacheVersion = compact ? 1 : boundedEdits ? 4 : referenced ? 3 : 2, cacheBytes = compact ? 16000 : 65536;
  const expand = (value, input) => compact ? expandModelPlan(value, input) : boundedEdits ? expandSourceEdits(value, input) : referenced ? expandReferencedSections(value, input) : value;
  const validate = (value, input, finishReason) => validateDescriptionRewrite(value, input, finishReason, format);
  const sourceMetrics = value => {
    if (!referenced || !value) return {};
    const items = value.sections.flatMap(section => section.items);
    const modelEditedItems = items.filter(item => item.text !== item.evidence).length;
    return { sourceCopiedItems: items.length - modelEditedItems, modelEditedItems };
  };
  const remember = (key, value) => {
    cache.set(key, value);
    if (cache.size > 128) cache.delete(cache.keys().next().value);
  };
  return { format, generate: async function generate(input, { signal, remainingMs = requestMs, factRange } = {}) {
    const startedAt = Date.now(), availableMs = Math.max(1, Math.floor(Math.min(requestMs, remainingMs)));
    const requestDeadline = startedAt + availableMs, timeout = AbortSignal.timeout(availableMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    combined.throwIfAborted();
    assertAlive();
    const ranges=compact&&!factRange?factPlanRanges(input):null;
    if(ranges){
      const rawValue={categories:[],overviewFactId:null};let generationRequests=0;
      for(let index=0;index<ranges.length;index++){
        const range=ranges[index];
        combined.throwIfAborted();
        let batch;
        try {batch=await generate(input,{signal:combined,remainingMs:Math.max(1,requestDeadline-Date.now()),factRange:range});}
        catch(error){
          generationRequests+=error.generationRequests||0;
          if(error.reason==='model_context_budget'&&range.end-range.start>1){
            const middle=Math.floor((range.start+range.end)/2);
            ranges.splice(index,1,{start:range.start,end:middle},{start:middle,end:range.end});index--;continue;
          }
          error.generationRequests=generationRequests;throw error;
        }
        generationRequests+=batch.generationRequests||0;
        // Validate the batch before combining it. A malformed or partial batch
        // must never publish an incomplete description.
        if(batch.finishReason!=='stop'||!expandModelPlan(batch.rawValue,input,{factRange:range}))return {...batch,value:null,generationRequests};
        rawValue.categories.push(...batch.rawValue.categories);
        if(range.start===0)rawValue.overviewFactId=batch.rawValue.overviewFactId;
      }
      return {value:expandModelPlan(rawValue,input),rawValue,format,finishReason:'stop',generationRequests};
    }
    const protocol = boundedEdits ? buildSourceEdits(input) : referenced ? buildReferencedSections(input) : null;
    const messages = protocol?.messages || (compact ? factPlanMessages(input,{factRange}) : rewriteMessages(input));
    const schema = protocol?.schema || (compact ? factPlanSchema(input,{factRange}) : REWRITE_SCHEMA);
    if (boundedEdits && !protocol.candidates.length) {
      const rawValue = { edits: [] }, value = expand(rawValue, input);
      return { value, rawValue, format, finishReason: 'stop', generationRequests: 0,
        renderedWithoutInference: true, ...sourceMetrics(value) };
    }
    const requestHash=createHash('sha256').update(JSON.stringify([REWRITE_MODEL,format,
      ...(compact ? [] : [input.inputHash]),messages,schema])).digest('hex');
    const cached=cache.get(requestHash);
    if(cached)return {...cached,value:expand(cached.rawValue,input),cachedModelPlan:true,cacheSource:'memory',generationRequests:0};
    const cacheFile=planCacheDir&&path.join(path.resolve(planCacheDir),requestHash+'.json');
    if(cacheFile){
      let entry;try{if((await fs.stat(cacheFile)).size<=cacheBytes)entry=JSON.parse(await fs.readFile(cacheFile,{encoding:'utf8',signal:combined}));}catch{}
      combined.throwIfAborted();
      if(entry?.version===cacheVersion&&entry.requestHash===requestHash){const value=expand(entry.rawValue,input);if(value&&validate(value,input,'stop').ok){const completion={value,rawValue:entry.rawValue,finishReason:'stop',format,...sourceMetrics(value)};remember(requestHash,completion);return {...completion,cachedModelPlan:true,cacheSource:'disk',generationRequests:0};}}
    }
    const initialOutputTokens = compact ? 768 : referenced ? REWRITE_MODEL.maxOutputTokens : 2048;
    let result, retrySkipped, generationRequests = 0, outputTokens = initialOutputTokens, promptTokens = 0;
    try {
      if (!compact || factRange) {
        // Count the actual local chat template, including special tokens. Sizing
        // and both completion attempts share the original request deadline.
        const metadata = async (route, body) => {
          combined.throwIfAborted();
          assertAlive();
          const response = await fetch(url.origin + route, { method: 'POST', signal: combined,
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (!response.ok) throw new RewriteGenerationError('Local generator sizing HTTP ' + response.status);
          try { return await response.json(); }
          catch (error) { if (error instanceof SyntaxError) throw new RewriteGenerationError('Malformed generator sizing response'); throw error; }
        };
        const rendered = await metadata('/apply-template', { messages, add_generation_prompt: true,
          chat_template_kwargs: { enable_thinking: false } });
        if (typeof rendered?.prompt !== 'string' || !rendered.prompt) throw new RewriteGenerationError('Missing generator prompt template');
        const counted = await metadata('/tokenize', { content: rendered.prompt, add_special: true, parse_special: true });
        if (!Array.isArray(counted?.tokens) || !counted.tokens.length || counted.tokens.some(token => !Number.isInteger(token))) {
          throw new RewriteGenerationError('Malformed generator token count');
        }
        assertAlive();
        promptTokens = counted.tokens.length;
        const headroom = REWRITE_MODEL.contextTokens - promptTokens - 64;
        if (headroom < 256) throw Object.assign(new RewriteGenerationError('Source exceeds model context budget'), { reason: 'model_context_budget' });
        outputTokens = Math.min(initialOutputTokens, headroom);
      }
      while (true) {
        combined.throwIfAborted();
        assertAlive();
        generationRequests++;
        const response = await fetch(url.origin + '/v1/chat/completions', { method: 'POST', signal: combined, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          model, messages, temperature: .2, top_p: .8, seed: 41 + generationRequests,
          ...(!compact ? { top_k: 20, min_p: 0, chat_template_kwargs: { enable_thinking: false } } : {}),
          max_tokens: outputTokens, stream: true, stream_options: { include_usage: true },
          response_format: { type: 'json_schema', json_schema: { name: 'job_description', strict: true, schema } },
        }) });
        if (!response.ok) throw new RewriteGenerationError('Local generator HTTP ' + response.status);
        if (response.headers.get('content-type')?.includes('text/event-stream')) result = await readCompletionStream(response);
        else {
          try { result = await response.json(); }
          catch (error) { if (error instanceof SyntaxError) throw new RewriteGenerationError('Malformed generator response'); throw error; }
        }
        assertAlive();
        if (result?.choices?.[0]?.finish_reason !== 'length' || generationRequests >= 2) break;
        // Retry only token truncation, within the original timeout and per-slot context.
        let retryTokens = Math.min(initialOutputTokens * 2,
          compact ? Math.floor(REWRITE_MODEL.contextTokens / 4) : referenced ? REWRITE_MODEL.maxRetryOutputTokens : 4096);
        if (!compact || factRange) retryTokens = Math.min(retryTokens, REWRITE_MODEL.contextTokens - promptTokens - 64);
        if (Number.isInteger(result.usage?.prompt_tokens) && result.usage.prompt_tokens >= 0) {
          retryTokens = Math.min(retryTokens, REWRITE_MODEL.contextTokens - result.usage.prompt_tokens - (compact ? 32 : 64));
        }
        if (retryTokens <= outputTokens) break;
        if (referenced) {
          const measuredPerToken = result.timings?.predicted_per_token_ms
            || (result.timings?.predicted_n > 0 ? result.timings.predicted_ms / result.timings.predicted_n : 0)
            || (result.usage?.completion_tokens > 0 ? (Date.now() - startedAt) / result.usage.completion_tokens : 0);
          const promptMs = Math.max(0, Number(result.timings?.prompt_ms) || 0);
          const estimatedRetryMs = promptMs + measuredPerToken * retryTokens * 1.1 + 1000;
          if (Number.isFinite(measuredPerToken) && measuredPerToken > 0 && requestDeadline - Date.now() < estimatedRetryMs) {
            retrySkipped = 'insufficient_time';
            break;
          }
        }
        outputTokens = retryTokens;
      }
    } catch (error) {
      error.generationRequests = generationRequests;
      error.rawText ||= result?.choices?.[0]?.message?.content?.slice(0, 2400);
      assertAlive();
      if (error.cause?.code === 'ECONNREFUSED') throw new RewriteWorkerError('connection_refused');
      if (['ECONNRESET','ETIMEDOUT','UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','Z_DATA_ERROR','Z_BUF_ERROR','Z_NEED_DICT'].includes(error.cause?.code)) {
        throw Object.assign(new RewriteGenerationError('Local generator request failed'), { generationRequests, rawText: error.rawText });
      }
      throw error;
    }
    assertAlive();
    const choice = result?.choices?.[0];
    if (!choice || typeof choice.message?.content !== 'string') throw Object.assign(new RewriteGenerationError('Malformed generator response'), { generationRequests });
    let value, expansionDiagnostic;
    try { value = JSON.parse(choice.message.content); }
    catch { value = null; if (boundedEdits) expansionDiagnostic = { code: 'invalid_json' }; }
    const expanded = boundedEdits ? expandSourceEdits(value, input, detail => { expansionDiagnostic ||= detail; }) : expand(value, input);
    const completion={value:expanded,rawValue:value,rawText:choice.message.content.slice(0,2400),finishReason:choice.finish_reason,timings:result.timings,usage:result.usage,generationRequests,format,...(retrySkipped&&{retrySkipped}),
      ...(expansionDiagnostic && { validationFailure: { ok: false, reason: expansionDiagnostic.code, diagnostic: expansionDiagnostic } })};
    Object.assign(completion, sourceMetrics(completion.value));
    if(completion.finishReason==='stop'&&completion.value&&validate(completion.value,input,'stop').ok){
      remember(requestHash,completion);
      if(cacheFile&&!combined.aborted){let temporary;try{const serialized=JSON.stringify({version:cacheVersion,requestHash,rawValue:completion.rawValue})+'\n';if(Buffer.byteLength(serialized)<=cacheBytes){await fs.mkdir(path.dirname(cacheFile),{recursive:true});temporary=cacheFile+'.'+randomUUID()+'.tmp';await fs.writeFile(temporary,serialized);await fs.rename(temporary,cacheFile);}}catch{if(temporary)await fs.rm(temporary,{force:true}).catch(()=>{});}}
    }
    return completion;
  } };
};

/** Exercise fresh inference before any production queue entry can consume an attempt. */
export const probeRewriteClient = async (client, { concurrency = 1, deadline = Date.now() + 180000, signal, onRejection = () => {}, onProbeEvent = () => {}, onProbeComplete = () => {} } = {}) => {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_REWRITE_CONCURRENCY) throw new Error('Invalid probe concurrency');
  const started = Date.now();
  const records = [];
  const emit = value => { try { onProbeEvent(value); } catch { /* diagnostics must not change readiness */ } };
  const probes = await Promise.allSettled(Array.from({ length: concurrency }, async (_, slot) => {
    const probeStarted = Date.now();
    const record = { slot, startedAt: new Date(probeStarted).toISOString() };
    records[slot] = record;
    emit({ event: 'probe_started', slot, timestamp: record.startedAt });
    try {
    signal?.throwIfAborted();
    const input = buildRewriteInput({ title: 'Software Engineer', company: 'Worker health check',
      sourceDescription: `Role overview: Build Python services for customer group ${slot + 1}. Responsibilities: Design reliable APIs and maintain Python services. Required qualifications: At least 2 years of software development experience is required. Preferred qualifications: AWS experience is nice to have.` });
    const response = await client.generate(input, { signal, remainingMs: Math.max(1, deadline - Date.now()), cacheMode: 'refresh', allowSourceFallback: false });
    signal?.throwIfAborted();
    if (response.cachedModelPlan || response.renderedWithoutInference) throw new RewriteWorkerError('generation_probe');
    const checked = response.finishReason === 'stop' && response.validationFailure
      ? response.validationFailure : validateDescriptionRewrite(response.value, input, response.finishReason, response.format || client.format);
    if (!checked.ok) {
      await onRejection({ id: 'worker-probe-' + slot, input, response, reason: checked.reason, diagnostic: checked.diagnostic });
      throw Object.assign(new RewriteGenerationError('Model readiness output was rejected'), { validationReason: checked.reason });
    }
    record.outcome = 'passed';
    } catch (error) {
      record.outcome = error instanceof RewriteGenerationError ? 'rejected' : 'failed';
      if (error.validationReason) record.reason = error.validationReason;
      record.error = error.errorDiagnostic || captureRewriteError(error, { phase: 'probe_worker' });
      throw error;
    } finally {
      record.finishedAt = new Date().toISOString();
      record.durationMs = Date.now() - probeStarted;
      emit({ event: 'probe_finished', ...record });
    }
  }));
  const rejections = probes.filter(result => result.status === 'rejected');
  const details = { requests: concurrency, durationMs: Date.now() - started, ready: rejections.length === 0, probes: records,
    ...(rejections.length ? { warnings: rejections.length } : {}) };
  try { onProbeComplete(details); } catch { /* diagnostics must not replace the original outcome */ }
  const failure = rejections.find(result => !(result.reason instanceof RewriteGenerationError) && !['TimeoutError','AbortError'].includes(result.reason?.name));
  if (failure) {
    const error = failure.reason.name === 'RewriteWorkerError' ? failure.reason : new RewriteWorkerError('generation_probe');
    throw Object.assign(error, { workerProbe: details });
  }
  if (signal?.aborted) {
    if (signal.reason && typeof signal.reason === 'object' && Object.isExtensible(signal.reason)) signal.reason.workerProbe = details;
    throw signal.reason;
  }
  return details;
};

/** Quality rejection leaves the queue untouched; execution failures still throw in the probe. */
export const rewriteWhenReady = async (probe, processQueue) => probe?.ready === true ? processQueue() : {
  attempted: 0, published: 0, failed: 0, skipped: 0, interrupted: true,
  qualityStopped: true, stopReason: 'readiness_rejected', reason: 'model_quality_unavailable',
};

export const rewriteQueueQuery = (now = new Date(), { shard = 0, shardCount = 1 } = {}) => {
  return { status: 'active', sourceContentHash: { $type: 'string' },
  ...rewriteShardFilter(shard, shardCount),
  $or: [
    { 'descriptionRewrite.status': 'pending', 'descriptionRewrite.attempts': { $lt: 3 } },
    { 'descriptionRewrite.status': 'failed', 'descriptionRewrite.attempts': { $lt: 3 },
      'descriptionRewrite.nextAttemptAt': { $type: 'date', $lte: now } },
    { 'descriptionRewrite.status': 'failed', 'descriptionRewrite.policyVersion': { $type: 'string', $ne: REWRITE_MODEL.policyVersion } },
    sourceCopyRetryQuery(),
  ],
  };
};

const deterministicRejections = new Set(['numeric_relationship_changed', 'required_scope_changed', 'preferred_scope_changed',
  'negation_changed', 'application_url_changed', 'source_details_changed', 'unsupported_claim', 'unsafe_output',
  'incomplete_source', 'empty_output', 'repetitive_output']);

// The built-in _id index streams a stable order without sorting full descriptions in memory.
// Queue timestamps are not indexed, and small Atlas clusters cannot spill that sort to disk.
export const rewriteQueueScan = (Job, query = rewriteQueueQuery()) => Job.find(query)
  .sort({ _id: 1 }).hint({ _id: 1 }).lean();

/** Materialize each small query before yielding: no server cursor waits for inference. */
export async function* rewriteQueuePages(Job, query = rewriteQueueQuery(), { pageSize = 8, deadline = Infinity, signal } = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 64) throw new Error('Invalid rewrite page size');
  let after;
  while (!signal?.aborted && Date.now() < deadline) {
    let page;
    try {
      page = await rewriteQueueScan(Job, after === undefined ? query : { $and: [query, { _id: { $gt: after } }] })
        .limit(pageSize).maxTimeMS(15000).exec();
    } catch (error) { error.rewritePhase = 'read_queue_page'; throw error; }
    if (!page.length) return;
    for (const job of page) {
      if (signal?.aborted || Date.now() >= deadline) return;
      yield job;
    }
    after = page.at(-1)._id;
    if (page.length < pageSize) return;
  }
}

export const rewriteFailureDetails = (error, phase) => ({
  errorType: error.name, errorPhase: phase,
  ...(Number.isInteger(error.code) ? { errorCode: error.code } : {}),
  ...(typeof error.codeName === 'string' && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(error.codeName)
    ? { errorCodeName: error.codeName } : {}),
  ...(Number.isInteger(error.workerExitCode) ? { workerExitCode: error.workerExitCode } : {}),
  ...(typeof error.workerSignal === 'string' && /^SIG[A-Z0-9]{1,20}$/.test(error.workerSignal) ? { workerSignal: error.workerSignal } : {}),
  ...(['process_exit', 'spawn_error', 'connection_refused', 'generation_probe'].includes(error.workerFailure) ? { workerFailure: error.workerFailure } : {}),
  ...(error.errorDiagnostic && { errorDiagnostic: captureRewriteError(error.errorDiagnostic) }),
  ...(error.workerProbe && { workerProbe: error.workerProbe }),
  ...(error.workerDiagnostics && { workerDiagnostics: error.workerDiagnostics }),
});

export const rewriteProgress = summary => {
  const jobWarnings = (summary.failed || 0) + (summary.staleSources || 0) + (summary.concurrentChanges || 0);
  return { warnings: jobWarnings + (summary.workerProbe?.warnings || 0) + (summary.sourceFallbackDescriptions || 0),
    pendingEstimate: Math.max(0, (summary.queued || 0) - (summary.published || 0) - (summary.skipped || 0) - jobWarnings) };
};

/** The caller supplies a Mongo update boundary; source/filter fields never enter these updates. */
export const rewriteCandidates = async (jobs, { client, update, deadline, signal, concurrency = 1, onResult = () => {},
  onRejection = () => {}, onFragmentRejection = () => {} } = {}) => {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_REWRITE_CONCURRENCY) throw new Error('Rewrite concurrency must be between one and ' + MAX_REWRITE_CONCURRENCY);
  const stats = { attempted: 0, published: 0, failed: 0, skipped: 0, queueRepairs: 0, staleSources: 0, concurrentChanges: 0,
    sourceFallbackDescriptions: 0, sourceFallbackBlocks: 0, interruptedAttempts: 0, interrupted: false, peakConcurrency: 0 };
  const processJob = async job => {
    if (signal?.aborted || Date.now() >= deadline) { stats.interrupted = true; return; }
    const reconciled = await reconcileRewriteCandidate(job, { update });
    if (reconciled.kind === 'stale') { stats.staleSources++; return; }
    if (reconciled.kind === 'conflict') { stats.concurrentChanges++; return; }
    if (reconciled.repaired) stats.queueRepairs++;
    if (reconciled.kind === 'skipped') {
      stats.skipped++;
      await onResult({ id: String(job._id), inputHash: reconciled.input.inputHash,
        ok: false, reason: reconciled.reason, durationMs: 0, generated: false });
      return;
    }
    job = reconciled.job;
    const { input } = reconciled;
    const filter = rewriteSnapshotFilter(job);
    if (signal?.aborted || Date.now() >= deadline) { stats.interrupted = true; return; }
    const started = Date.now();
    const assessment = assessDescriptionRewrite(input, client.format);
    if (assessment.ok) stats.attempted++;
    let response, result, interruptedTelemetry;
    const recordInterruption = async telemetry => {
      stats.interrupted = true;
      stats.interruptedAttempts++;
      await onResult({ id: String(job._id), inputHash: input.inputHash, ok: false, published: false,
        interrupted: true, reason: signal?.aborted && signal.reason?.name !== 'TimeoutError' ? 'cancelled' : 'budget_exhausted',
        generated: assessment.ok, durationMs: Date.now() - started,
        ...Object.fromEntries(['generationRequests', 'correctionRequests', 'correctionsAccepted', 'correctionsRejected',
          'correctionsSkipped', 'transportRetries'].map(key => [key, telemetry?.[key] || 0])) });
    };
    try {
      if (!assessment.ok) result = assessment;
      else {
      response = await client.generate(input, { signal, remainingMs: deadline - started,
        onInterrupted: telemetry => { interruptedTelemetry = telemetry; },
        onFragmentRejection: rejection => onFragmentRejection({ ...rejection, id: String(job._id), input }) });
      if (signal?.aborted || Date.now() >= deadline) return recordInterruption(response);
      result = response.finishReason === 'stop' && response.validationFailure
        ? response.validationFailure : validateDescriptionRewrite(response.value, input, response.finishReason, response.format || client.format);
      if (result.ok && Number.isInteger(response.modelEditedItems)) result.quality = { ...result.quality,
        method: 'source_referenced_sections', modelEditedItems: response.modelEditedItems, sourceCopiedItems: response.sourceCopiedItems };
      }
    } catch (error) {
      const expectedAbort = ['TimeoutError', 'AbortError'].includes(error.name) || error === signal?.reason;
      if (!(error instanceof RewriteGenerationError) && !expectedAbort) throw error;
      if (signal?.aborted || Date.now() >= deadline) return recordInterruption(interruptedTelemetry || error);
      if (Number.isInteger(error.generationRequests) || error.rawText) response = { generationRequests: error.generationRequests,
        rawText: error.rawText, usage: error.usage, timings: error.timings, generations: error.generations,
        transportRetries: error.transportRetries, reusedChunks: error.reusedChunks,
        correctionRequests: error.correctionRequests, correctionsAccepted: error.correctionsAccepted,
        correctionsRejected: error.correctionsRejected, correctionsSkipped: error.correctionsSkipped, correctionMode: error.correctionMode };
      response = { ...response, errorDiagnostic: error.errorDiagnostic || captureRewriteError(error, { phase: 'generate', sourceTexts: [input.sourceDescription] }) };
      result = { ok: false, reason: error.name === 'TimeoutError' ? 'timeout'
        : error.reason === 'model_context_budget' ? 'model_context_budget' : 'generation_error' };
    }
    if (!result.ok && assessment.ok) await onRejection({ id: String(job._id), input, response, reason: result.reason, diagnostic: result.diagnostic });
    const now = new Date(), durationMs = Date.now() - started;
    const metadata = { 'descriptionRewrite.attemptedAt': now, 'descriptionRewrite.durationMs': durationMs,
      'descriptionRewrite.modelRevision': REWRITE_MODEL.revision, 'descriptionRewrite.runtimeTag': REWRITE_MODEL.runtimeTag,
      'descriptionRewrite.policyVersion': REWRITE_MODEL.policyVersion,
      'descriptionRewrite.status': result.ok ? 'published' : !assessment.ok || ['not_improved','already_structured','dense_source','uncertain_section_assignment','model_context_budget'].includes(result.reason) ? 'skipped' : 'failed', 'descriptionRewrite.reason': result.ok ? null : result.reason };
    const values = { $set: { ...metadata,
      ...(result.ok ? { description: result.description, descriptionFormat: 'markdown', 'descriptionRewrite.publishedAt': now,
        'descriptionRewrite.wordCount': result.wordCount, 'descriptionRewrite.quality': result.quality || null } : { 'descriptionRewrite.nextAttemptAt': new Date(now.getTime() + 3600000) }),
    }, $inc: { 'descriptionRewrite.attempts': 1 } };
    if (!result.ok && deterministicRejections.has(result.reason)) values.$set['descriptionRewrite.nextAttemptAt'] = null;
    const saved = await update(filter, values);
    if (saved.matchedCount === 0) stats.concurrentChanges++;
    else if (result.ok) {
      stats.published++;
      const fallbackBlocks = result.quality?.sourceFallbackBlocks || 0;
      if (fallbackBlocks) { stats.sourceFallbackDescriptions++; stats.sourceFallbackBlocks += fallbackBlocks; }
    }
    else if (!assessment.ok || ['not_improved','already_structured','dense_source','uncertain_section_assignment','model_context_budget'].includes(result.reason)) stats.skipped++;
    else stats.failed++;
    await onResult({ id: String(job._id), inputHash: input.inputHash, ok: result.ok,
      published: result.ok && saved.matchedCount !== 0, reason: result.reason, durationMs, wordCount: result.wordCount, generated: assessment.ok, modelPlanCached: response?.cachedModelPlan || false,
      ...(response?.errorDiagnostic && { errorDiagnostic: response.errorDiagnostic }),
      generationRequests: response?.generationRequests ?? (assessment.ok && !response?.cachedModelPlan ? 1 : 0), renderedWithoutInference: response?.renderedWithoutInference,
      retrySkipped: response?.retrySkipped, quality: result.quality, usage: response?.usage, timings: response?.timings,
      generations: response?.generations, reusedChunks: response?.reusedChunks, transportRetries: response?.transportRetries,
      correctionRequests: response?.correctionRequests, correctionsAccepted: response?.correctionsAccepted,
      correctionsRejected: response?.correctionsRejected, correctionsSkipped: response?.correctionsSkipped, correctionMode: response?.correctionMode,
      cacheSource: response?.cacheSource, sharedGeneration: response?.sharedGeneration });
  };
  const pending = new Set();
  let failure;
  try {
    // One producer owns the cursor; only generation and guarded updates overlap.
    for await (const job of jobs) {
      if (failure) break;
      if (signal?.aborted || Date.now() >= deadline) { stats.interrupted = true; break; }
      const task = processJob(job).catch(error => { failure ??= error; }).finally(() => pending.delete(task));
      pending.add(task);
      stats.peakConcurrency = Math.max(stats.peakConcurrency, pending.size);
      if (pending.size >= concurrency) await Promise.race(pending);
    }
  } catch (error) { failure ??= error; }
  // Always finish scheduled work before callers close the cursor, model, or database.
  await Promise.all(pending);
  if (signal?.aborted || Date.now() >= deadline) stats.interrupted = true;
  if (failure) { failure.rewriteStats = { ...stats }; throw failure; }
  return stats;
};
