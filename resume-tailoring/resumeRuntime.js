import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { availableParallelism } from 'node:os';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import { Agent } from 'undici';
import { resumeFailure, safeResumeDiagnostic } from './resumeDiagnostics.js';
import { RESUME_WORKER_BUDGET_MS } from './resumeBudget.js';
import { PAGINATION_REPAIR_MAX_TOKENS, paginationRepairSchema, applyPaginationRepair } from './resumePaginationRepair.js';
import { buildResumeLatexGrammar, RESUME_LATEX_PREAMBLE, RESUME_LATEX_FORMAT_INSTRUCTION, RESUME_LATEX_PREFILL_INSTRUCTION } from '../src/utils/resumeLatexFormat.js';

export const RESUME_MODEL = JSON.parse(await fs.readFile(new URL('./resume-model.json', import.meta.url), 'utf8'));
const root = fileURLToPath(new URL('../', import.meta.url));
const serverUrl = 'http://127.0.0.1:8770';
export function remainingBudget(deadline, maximum) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw resumeFailure('time_limit', { statusCode: 504 });
  return Math.max(1, Math.floor(Math.min(remaining, maximum)));
}
async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function immutableDownload(url, target, digest, deadline) {
  remainingBudget(deadline, 2147483647);
  try { if (await hashFile(target) === digest) return; } catch { /* no cached asset */ }
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.download`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(remainingBudget(deadline, 2147483647)) });
    if (!response.ok || !response.body) throw new Error('Pinned resume model/runtime download failed.');
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
    if (await hashFile(temporary) !== digest) throw new Error('Pinned resume model/runtime checksum mismatch.');
    await fs.rename(temporary, target);
  } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
}
async function findBinary(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === 'llama-server') return target;
    if (entry.isDirectory()) { const found = await findBinary(target); if (found) return found; }
  }
}
export async function prepareResumeModel({ cacheRoot = root, deadline = Date.now() + 29 * 60000 } = {}) {
  if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Resume inference requires the Linux x64 Actions runner.');
  const model = path.join(cacheRoot, '.cache/resume-models', RESUME_MODEL.file);
  await immutableDownload(`https://huggingface.co/${RESUME_MODEL.modelId}/resolve/${RESUME_MODEL.revision}/${RESUME_MODEL.file}`, model, RESUME_MODEL.sha256, deadline);
  const runtime = path.join(cacheRoot, '.cache/resume-runtime', RESUME_MODEL.runtimeTag);
  const archive = path.join(runtime, RESUME_MODEL.runtimeFile);
  await immutableDownload(`https://github.com/ggml-org/llama.cpp/releases/download/${RESUME_MODEL.runtimeTag}/${RESUME_MODEL.runtimeFile}`, archive, RESUME_MODEL.runtimeSha256, deadline);
  await new Promise((resolve, reject) => {
    const child = spawn('tar', ['-xzf', archive, '-C', runtime], { stdio: 'ignore', signal: AbortSignal.timeout(remainingBudget(deadline, 30000)) });
    child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('Pinned resume runtime could not be extracted.')));
  });
  const binary = await findBinary(runtime);
  if (!binary) throw new Error('Pinned resume runtime is missing llama-server.');
  // Do not pass database credentials or GitHub secrets into the model process.
  const server = spawn(binary, ['--model', model, '--host', '127.0.0.1', '--port', '8770', '--ctx-size', String(RESUME_MODEL.contextTokens),
    '--threads', String(Math.min(4, availableParallelism())), '--parallel', '1', '--jinja', '--log-disable'], {
    stdio: 'ignore', windowsHide: true, env: { PATH: process.env.PATH, LD_LIBRARY_PATH: path.dirname(binary), HOME: '/tmp' },
  });
  let startupError;
  server.once('error', error => { startupError = error; });
  // Health checks stay on loopback even when the host enables an HTTP proxy.
  const healthDispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
  try {
    const readyBy = Math.min(deadline, Date.now() + 120000);
    while (Date.now() < readyBy) {
      if (startupError || server.exitCode !== null) throw new Error('The resume model server could not start.');
      try { if ((await fetch(`${serverUrl}/health`, { dispatcher: healthDispatcher, signal: AbortSignal.timeout(remainingBudget(readyBy, 1000)) })).ok) return { stop: () => server.kill('SIGTERM') }; } catch { /* model loading */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('The resume model server did not become ready.');
  } catch (error) { server.kill('SIGTERM'); throw error; }
  finally { await healthDispatcher.destroy(); }
}
const comparisonSchema = { type: 'object', additionalProperties: false, required: ['evidence', 'missingFacts', 'unsupportedClaims', 'supported'], properties: {
  evidence: { type: 'string', minLength: 1, maxLength: 512 },
  missingFacts: { type: 'array', items: { type: 'string' } }, unsupportedClaims: { type: 'array', items: { type: 'string' } }, supported: { type: 'boolean' },
} };
const modelTimeoutCodes = new Set(['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_CONNECT_TIMEOUT', 'ETIMEDOUT']);
function modelRequestFailure(error, signal, fallbackCode) {
  const timedOut = signal.aborted || modelTimeoutCodes.has(error?.code) || modelTimeoutCodes.has(error?.cause?.code);
  return resumeFailure(timedOut ? 'model_timeout' : fallbackCode);
}
function monitorModelProgress({ fetchImpl, deadline, signal, onDiagnostic, stage, inputTokens }) {
  const stopped = new AbortController();
  const started = Date.now();
  let polling = false;
  const timer = setInterval(async () => {
    if (polling || stopped.signal.aborted) return;
    polling = true;
    const dispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
    try {
      const timeout = AbortSignal.timeout(remainingBudget(deadline, 5000));
      const response = await fetchImpl(`${serverUrl}/slots`, { method: 'GET', dispatcher,
        signal: AbortSignal.any([stopped.signal, timeout, ...(signal ? [signal] : [])]) });
      if (!response.ok) return;
      const slots = await response.json();
      const slot = Array.isArray(slots) && slots.find(value => value?.is_processing === true);
      if (!slot || stopped.signal.aborted) return;
      // Slots also contain private prompts and settings. Never forward them.
      onDiagnostic(safeResumeDiagnostic({ stage, code: 'progress', seconds: (Date.now() - started) / 1000, inputTokens,
        processedTokens: slot.n_prompt_tokens_processed, outputTokens: slot.next_token?.[0]?.n_decoded }));
    } catch { /* Progress is optional; inference retains its own deadline. */ }
    finally { polling = false; await dispatcher.destroy(); }
  }, 60000);
  timer.unref?.();
  return () => { clearInterval(timer); stopped.abort(); };
}
export async function generateResumeText(prompt, { fetchImpl = fetch, deadline = Date.now() + RESUME_WORKER_BUDGET_MS, signal: parentSignal, comparison = false, paginationRepair = false, paginationBreakIds, preparationPlan, tailoringPlan, allowedLinks = [], pagination, sectionTitles = [], layout, headerChoices = [], onDiagnostic = () => {}, onUsage = () => {} } = {}) {
  if (preparationPlan && !comparison && !paginationRepair) {
    const choice = await generateResumeText(preparationPlan.prompt, { fetchImpl, deadline, signal: parentSignal,
      paginationRepair: true, pagination, paginationBreakIds: preparationPlan.candidates.map(candidate => candidate.id),
      // Layout timings cannot estimate the cost of a later full-document repair.
      onDiagnostic: event => onDiagnostic({ ...event, stage: 'generating' }) });
    return applyPaginationRepair(preparationPlan, choice);
  }
  // Replace only our complete trusted instruction block. The actual template
  // follows as the assistant prefix; source/repair JSON and audit evidence stay
  // intact, including any template-looking text supplied by a candidate.
  const editPlan = !comparison && !paginationRepair ? tailoringPlan : null;
  const json = comparison || paginationRepair || Boolean(editPlan);
  const stage = comparison ? 'comparing' : paginationRepair ? 'repairing' : 'generating';
  const messages = [{ role: 'user', content: editPlan ? editPlan.prompt : json ? prompt : prompt.replace(RESUME_LATEX_FORMAT_INSTRUCTION, RESUME_LATEX_PREFILL_INSTRUCTION) }];
  const outputLimit = comparison ? RESUME_MODEL.comparisonOutputTokens : paginationRepair ? PAGINATION_REPAIR_MAX_TOKENS : editPlan ? editPlan.maxTokens : RESUME_MODEL.maxOutputTokens;
  const request = async (endpoint, body) => {
    const timeout = AbortSignal.timeout(remainingBudget(deadline, RESUME_WORKER_BUDGET_MS));
    const signal = parentSignal ? AbortSignal.any([parentSignal, timeout]) : timeout;
    // The abort signal bounds the whole request, including the response body.
    // Undici's separate five-minute timers must not preempt that deadline.
    const dispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
    try {
      let response;
      try {
        response = await fetchImpl(`${serverUrl}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal, dispatcher, body: JSON.stringify(body) });
      } catch (error) { throw modelRequestFailure(error, signal, 'model_unavailable'); }
      if (!response.ok) throw resumeFailure('model_unavailable');
      try { return await response.json(); } catch (error) { throw modelRequestFailure(error, signal, 'model_protocol_invalid'); }
    } finally { await dispatcher.destroy(); }
  };
  const chatTemplateKwargs = { enable_thinking: false };
  const rendered = await request('/apply-template', { messages, chat_template_kwargs: chatTemplateKwargs });
  if (typeof rendered.prompt !== 'string') throw resumeFailure('model_protocol_invalid');
  // The grammar previously forced every byte of this immutable prefix through
  // slow token decoding. Prefill those same bytes in the assistant context and
  // generate only the candidate body; no layout or candidate facts are rewritten.
  const prefix = json ? '' : RESUME_LATEX_PREAMBLE + (layout?.contactHeader || '');
  const fullPrompt = rendered.prompt + prefix;
  const tokens = await request('/tokenize', { content: fullPrompt, add_special: true, parse_special: true });
  if (!Array.isArray(tokens.tokens) || !tokens.tokens.every(Number.isInteger)) throw resumeFailure('model_protocol_invalid');
  onDiagnostic(safeResumeDiagnostic({ stage, code: 'started', inputTokens: tokens.tokens.length }));
  // A maximum output allowance is not a fixed input reservation. Use the
  // remaining context without dropping source data; keep enough room for a
  // complete document and the full, small JSON budgets used by validation.
  const maxTokens = Math.min(outputLimit, RESUME_MODEL.contextTokens - tokens.tokens.length - 32);
  if (maxTokens < (json ? outputLimit : 2048)) throw resumeFailure('input_too_large', { statusCode: 422 });
  const stopProgress = monitorModelProgress({ fetchImpl, deadline, signal: parentSignal, onDiagnostic,
    stage, inputTokens: tokens.tokens.length });
  let payload;
  try {
    payload = json
      ? await request('/v1/chat/completions', { messages, chat_template_kwargs: chatTemplateKwargs, temperature: 0, max_tokens: maxTokens, stream: false,
        response_format: { type: 'json_schema', json_schema: { name: comparison ? 'resume_source_comparison' : editPlan ? 'resume_tailoring_edits' : 'resume_pagination_repair', strict: true,
          schema: comparison ? comparisonSchema : editPlan ? editPlan.schema : paginationRepairSchema(pagination, paginationBreakIds) } } })
      : await request('/completion', { prompt: fullPrompt, temperature: 0.7, top_p: 0.8, top_k: 20, min_p: 0,
        presence_penalty: 1.5, n_predict: maxTokens, stream: false,
        grammar: buildResumeLatexGrammar(allowedLinks, pagination, { includePreamble: false, includeHeader: false, sectionTitles, layout, headerChoices }) });
  } finally { stopProgress(); }
  const content = json ? payload.choices?.[0]?.message?.content : payload.content;
  const complete = json ? payload.choices?.[0]?.finish_reason === 'stop' : payload.stop_type === 'eos' && payload.truncated !== true;
  onDiagnostic(safeResumeDiagnostic({ stage, code: complete ? 'passed' : 'model_output_incomplete',
    outputTokens: json ? payload.usage?.completion_tokens : payload.timings?.predicted_n }));
  const usage = {};
  for (const [key, value] of Object.entries({ inputTokens: payload.timings?.prompt_n, outputTokens: payload.timings?.predicted_n,
    promptMilliseconds: payload.timings?.prompt_ms, outputMilliseconds: payload.timings?.predicted_ms })) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) usage[key] = value;
  }
  onUsage(usage);
  if (!complete || typeof content !== 'string') throw resumeFailure('model_output_incomplete');
  return editPlan ? editPlan.apply(content) : prefix + content;
}
