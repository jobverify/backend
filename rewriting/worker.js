import fs from 'node:fs/promises';
import { createReadStream, createWriteStream, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { REWRITE_MODEL } from '../src/services/jobDescriptionPolicy.js';
import { captureRewriteError, redactRewriteDiagnostic } from './failureDiagnostics.js';

export const MAX_REWRITE_CONCURRENCY = 32;

const root = fileURLToPath(new URL('../', import.meta.url));
const exec = promisify(execFile);
export const sha256File = async file => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
export const ensureArtifact = async ({ file, url, sha256, signal, allowDownload = true }) => {
  try { if (await sha256File(file) === sha256) return file; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!allowDownload) throw Object.assign(new Error('Verified rewrite asset unavailable: ' + path.basename(file)), { code: 'REWRITE_ASSETS_UNAVAILABLE' });
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.' + randomUUID() + '.part';
  try {
    const response = await fetch(url, { signal });
    if (!response.ok || !response.body) throw new Error('Artifact download HTTP ' + response.status);
    await pipeline(response.body, createWriteStream(temporary, { flags: 'wx' }), { signal });
    if (await sha256File(temporary) !== sha256) throw new Error('Artifact checksum mismatch');
    await fs.rename(temporary, file);
    return file;
  } finally { await fs.rm(temporary, { force: true }); }
};
const findServer = async (directory, platform, depth = 0) => {
  if (depth > 3) return null;
  const executable = platform === 'win32' ? 'llama-server.exe' : 'llama-server';
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === executable && entry.isFile()) return path.join(directory, entry.name);
    if (entry.isDirectory()) { const found = await findServer(path.join(directory, entry.name), platform, depth + 1); if (found) return found; }
  }
  return null;
};
export const verifyRewriteBinary = async (binary, sha256) => {
  if (typeof binary !== 'string' || typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(sha256)) throw new TypeError('A custom rewrite binary requires its SHA-256 checksum');
  const resolved = path.resolve(binary);
  if (await sha256File(resolved) !== sha256.toLowerCase()) throw new Error('Custom rewrite binary checksum mismatch');
  return resolved;
};

export const rewriteGpuLayers = (value = 0) => {
  if (value === 'all' || value === 'auto') return value;
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === ''
    || !Number.isSafeInteger(Number(value)) || Number(value) < 0) throw new TypeError('GPU layers must be a nonnegative integer, all or auto');
  return Number(value);
};

export const prepareRewriteRuntime = async ({ directory = path.join(root, '.cache/description-rewriter'), signal, platform = process.platform,
  allowDownload = true, binaryOverride, binarySha256 } = {}) => {
  const customBinary = binaryOverride ? await verifyRewriteBinary(binaryOverride, binarySha256) : null;
  const asset = REWRITE_MODEL.runtimeAssets[platform];
  if (!asset || process.arch !== 'x64') throw new Error('Pinned rewriting runtime supports Linux/Windows x64');
  if (allowDownload) await fs.mkdir(directory, { recursive: true });
  const modelFile = await ensureArtifact({ file: path.join(directory, REWRITE_MODEL.file),
    url: 'https://huggingface.co/' + REWRITE_MODEL.modelId + '/resolve/' + REWRITE_MODEL.revision + '/' + REWRITE_MODEL.file,
    sha256: REWRITE_MODEL.sha256, signal, allowDownload });
  if (customBinary) return { modelFile, binary: customBinary, binarySha256: binarySha256.toLowerCase(), runtimeKind: 'custom' };
  const archive = await ensureArtifact({ file: path.join(directory, asset.file),
    url: 'https://github.com/ggml-org/llama.cpp/releases/download/' + REWRITE_MODEL.runtimeTag + '/' + asset.file,
    sha256: asset.sha256, signal, allowDownload });
  const runtime = path.join(directory, 'runtime'), marker = path.join(directory, 'runtime-identity.json');
  const identity = JSON.stringify({ tag: REWRITE_MODEL.runtimeTag, sha256: asset.sha256, platform });
  let installed = false;
  try { installed = await fs.readFile(marker, 'utf8') === identity && !!await findServer(runtime, platform); } catch { /* cache miss */ }
  if (!installed) {
    await fs.mkdir(runtime, { recursive: true });
    if (platform === 'win32') await exec('powershell.exe', ['-NoProfile', '-Command',
      "Expand-Archive -LiteralPath '" + archive.replaceAll("'", "''") + "' -DestinationPath '" + runtime.replaceAll("'", "''") + "' -Force"], { windowsHide: true, signal });
    else await exec('tar', ['-xzf', archive, '-C', runtime], { signal });
    await fs.writeFile(marker, identity);
  }
  const binary = await findServer(runtime, platform);
  if (!binary) throw new Error('Pinned CPU server executable missing');
  return { modelFile, binary, runtimeArchiveSha256: asset.sha256, runtimeKind: 'pinned-cpu' };
};

export function rewriteWorkerConfiguration({ threads = REWRITE_MODEL.cpuThreads, parallelism = 1, availableCpus = os.availableParallelism(), gpuLayers = 0 } = {}) {
  if (![threads, parallelism, availableCpus].every(value => ['number', 'string'].includes(typeof value)
    && Number.isSafeInteger(Number(value)) && Number(value) > 0) || Number(parallelism) > MAX_REWRITE_CONCURRENCY) throw new Error('Invalid rewrite parallelism or threads');
  const requestedGpuLayers = rewriteGpuLayers(gpuLayers);
  const cpus = Number(availableCpus);
  const slots = Math.min(requestedGpuLayers === 0 ? cpus : MAX_REWRITE_CONCURRENCY, Number(parallelism));
  return { threads: Math.min(cpus, Number(threads)), parallelism: slots, contextTokens: REWRITE_MODEL.contextTokens * slots };
}

// GDB's --args shell-escapes argv; its startup shell must decode those escapes.
const nativeDebuggerArguments = (binary, args) => ['--nx', '--quiet', '--batch', '--return-child-result',
  '-iex', 'set auto-load off', '-iex', 'set debuginfod enabled off', '-ex', 'set startup-with-shell on',
  '-x', path.join(root, 'rewriting/nativeBacktrace.py'), '-ex', 'run', '-ex', 'python finish_rewrite_debugging()', '--args', binary, ...args];

export const collectRewriteRuntimeDiagnostics = async ({ binary, nativeBacktrace = false, platform = process.platform, execute = exec } = {}) => {
  const details = { platform, arch: process.arch, osRelease: os.release(), runtimeTag: REWRITE_MODEL.runtimeTag,
    cpu: { model: os.cpus()[0]?.model || 'unknown', flags: [] }, binary: { file: path.basename(binary) },
    nativeBacktrace: { requested: nativeBacktrace, enabled: false, reason: nativeBacktrace ? 'unsupported_platform' : 'not_requested' } };
  if (platform === 'linux') {
    try { details.cpu.flags = (await fs.readFile('/proc/cpuinfo', 'utf8')).match(/^flags\s*:\s*(.*)$/m)?.[1].trim().split(/\s+/).slice(0, 256) || []; }
    catch { details.cpu.flagsUnavailable = true; }
  }
  try { details.binary.sha256 = await sha256File(binary); }
  catch (error) { details.binary.hashError = captureRewriteError(error, { phase: 'runtime_identity' }); }
  try {
    const result = await execute(binary, ['--version'], { windowsHide: true, timeout: 3000, maxBuffer: 16384 });
    details.binary.version = redactRewriteDiagnostic((result.stdout || result.stderr).trim(), { limit: 2048 });
  } catch (error) { details.binary.versionError = captureRewriteError(error, { phase: 'runtime_identity' }); }
  if (nativeBacktrace && platform === 'linux') {
    let temporary;
    try {
      const result = await execute('gdb', ['--version'], { timeout: 3000, maxBuffer: 16384 });
      details.nativeBacktrace.version = redactRewriteDiagnostic(result.stdout.split('\n')[0]);
      details.nativeBacktrace.reason = 'debugger_preflight_failed';
      temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite-debugger-preflight-'));
      const file = path.join(temporary, 'native.json');
      const probeArgs = ['{"enable_thinking":false}', 'model path with spaces.gguf', '\'"\\$;*[]', ''];
      const probe = 'require("node:assert/strict").deepEqual(process.argv.slice(1), ' + JSON.stringify(probeArgs) + ')';
      await execute('gdb', nativeDebuggerArguments(process.execPath, ['-e', probe, '--', ...probeArgs]), { timeout: 5000, maxBuffer: 16384,
        env: { ...process.env, JOB_DESCRIPTION_NATIVE_DIAGNOSTIC_FILE: file } });
      const observed = JSON.parse(await fs.readFile(file, 'utf8'));
      if (observed.state !== 'running' || !Number.isInteger(observed.pid) || observed.pid <= 0) throw new Error('Debugger preflight did not observe a running inferior');
      details.nativeBacktrace.enabled = true;
      details.nativeBacktrace.reason = 'available';
    } catch (error) {
      if (details.nativeBacktrace.reason !== 'debugger_preflight_failed') details.nativeBacktrace.reason = 'debugger_unavailable';
      details.nativeBacktrace.error = captureRewriteError(error, { phase: 'runtime_identity' });
    } finally {
      if (temporary) await fs.rm(temporary, { recursive: true, force: true }).catch(error => {
        details.nativeBacktrace.cleanupError = captureRewriteError(error, { phase: 'runtime_identity' });
      });
    }
  }
  return details;
};

export class RewriteWorkerError extends Error {
  constructor(workerFailure, { exitCode, signal, workerDiagnostics } = {}) {
    super('CPU generator failure: ' + workerFailure);
    this.name = 'RewriteWorkerError';
    this.workerFailure = workerFailure;
    if (Number.isInteger(exitCode)) this.workerExitCode = exitCode;
    if (typeof signal === 'string') this.workerSignal = signal;
    if (workerDiagnostics) this.workerDiagnostics = workerDiagnostics;
  }
}

export const startRewriteWorker = async ({ modelFile, binary, port = 8766, threads = REWRITE_MODEL.cpuThreads, parallelism = 1, gpuLayers = 0, deadline = Date.now() + 120000, signal, logFile = path.join(root, '.cache/scraper-actions/description-worker.log'), spawnProcess = spawn, fetchImpl = fetch, nativeBacktrace = false }) => {
  const requestedGpuLayers = rewriteGpuLayers(gpuLayers);
  const config = rewriteWorkerConfiguration({ threads, parallelism, gpuLayers: requestedGpuLayers });
  const model = 'job-description-' + randomUUID();
  await fs.mkdir(path.dirname(logFile), { recursive: true });
  const log = await fs.open(logFile, 'w');
  const debugging = nativeBacktrace && process.platform === 'linux';
  const nativeFile = path.resolve(logFile + '.native.json');
  if (debugging) await fs.rm(nativeFile, { force: true });
  const args = ['-m', modelFile, '--host', '127.0.0.1', '--port', String(port),
    '--alias', model, '-c', String(config.contextTokens), '-np', String(config.parallelism), '-t', String(config.threads), '-tb', String(config.threads),
    '-ngl', String(requestedGpuLayers), '--sleep-idle-seconds', '-1', '--jinja', '--no-context-shift', '--no-webui', '--log-verbosity', '3',
    '--chat-template-kwargs', JSON.stringify({ enable_thinking: REWRITE_MODEL.enableThinking === true }),
    '--reasoning', 'off', '--no-reasoning-preserve', '--cache-ram', '128'];
  const launch = { event: 'worker_start', timestamp: new Date().toISOString(), executable: path.basename(binary),
    arguments: args, debugger: debugging ? 'gdb' : 'none' };
  await log.writeFile(JSON.stringify(launch) + '\n');
  let child;
  try {
    const command = debugging ? 'gdb' : binary;
    const commandArgs = debugging ? nativeDebuggerArguments(binary, args) : args;
    child = spawnProcess(command, commandArgs, { cwd: path.dirname(binary), windowsHide: true, detached: debugging,
      env: { ...process.env, LD_LIBRARY_PATH: path.dirname(binary) + path.delimiter + (process.env.LD_LIBRARY_PATH || ''),
        ...(debugging && { JOB_DESCRIPTION_NATIVE_DIAGNOSTIC_FILE: nativeFile }) },
      stdio: ['ignore', log.fd, log.fd] });
  } catch (error) {
    await log.close();
    throw Object.assign(new RewriteWorkerError('spawn_error', { workerDiagnostics: { launch } }), { errorDiagnostic: captureRewriteError(error, { phase: 'start_worker' }) });
  }
  let error, exited = false;
  let exitCode = null, exitSignal = null;
  // Install listeners before awaiting anything: spawn errors can arrive on the next tick.
  child.on('error', value => { error = value; });
  const exit = new Promise(resolve => child.once('exit', (code, signal) => { exited = true; exitCode = code; exitSignal = signal; resolve(); }));
  const nativeDiagnostics = () => {
    if (!debugging) return undefined;
    try {
      if (statSync(nativeFile).size > 65536) return { backtraceUnavailable: 'size_limit' };
      const value = JSON.parse(readFileSync(nativeFile, 'utf8'));
      return { ...(Number.isInteger(value.pid) && value.pid > 0 && { pid: value.pid }),
        ...(['SIGSEGV', 'SIGABRT', 'SIGBUS', 'SIGILL', 'SIGFPE'].includes(value.signal) && { signal: value.signal }),
        ...(typeof value.backtrace === 'string' && { backtrace: redactRewriteDiagnostic(value.backtrace, { limit: 32768 }) }),
        ...(['capture_failed', 'unexpected_stop'].includes(value.backtraceUnavailable) && { backtraceUnavailable: value.backtraceUnavailable }) };
    } catch { return { backtraceUnavailable: 'not_recorded' }; }
  };
  const diagnostics = () => {
    const native = nativeDiagnostics();
    return { pid: native?.pid || child.pid, status: error ? 'spawn_error'
      : exited || child.exitCode != null || child.signalCode != null ? 'exited' : 'running',
    exitCode: debugging ? null : exitCode ?? child.exitCode ?? null,
    signal: debugging ? native?.signal || null : exitSignal ?? child.signalCode ?? null,
    launch, ...(debugging && { native, debugger: { pid: child.pid, exitCode: exitCode ?? child.exitCode ?? null, signal: exitSignal ?? child.signalCode ?? null } }) };
  };
  const assertAlive = () => {
    const state = diagnostics();
    if (state.status !== 'running') throw Object.assign(new RewriteWorkerError(error ? 'spawn_error' : 'process_exit', { ...state, workerDiagnostics: state }),
      error && { errorDiagnostic: captureRewriteError(error, { phase: 'start_worker' }) });
  };
  const kill = signal => {
    if (debugging && child.pid) { try { process.kill(-child.pid, signal); return; } catch { /* already reaped or unsupported */ } }
    child.kill(signal);
  };
  const stop = async () => {
    if (!exited && child.pid) { kill('SIGTERM'); await Promise.race([exit, delay(5000, undefined, { ref: false })]); if (!exited) kill('SIGKILL'); }
  };
  const endpoint = 'http://127.0.0.1:' + port;
  try {
    await log.close();
    const startupDeadline = Math.min(deadline, Date.now() + 120000);
    while (Date.now() < startupDeadline) {
      signal?.throwIfAborted();
      assertAlive();
      try {
        const response = await fetchImpl(endpoint + '/v1/models', { signal: AbortSignal.timeout(1000) });
        const health = response.ok ? await response.json() : null;
        if (health?.data?.some(row => row.id === model)) {
          assertAlive();
          return { endpoint, model, pid: diagnostics().pid, stop, assertAlive, diagnostics, parallelism: config.parallelism, gpuLayers: requestedGpuLayers };
        }
      } catch { /* bounded readiness poll */ }
      await delay(200, undefined, { signal });
    }
    throw new Error('CPU generator startup deadline exceeded');
  } catch (failure) { await stop(); throw failure; }
};

export const workerMemoryBytes = async pid => {
  if (process.platform === 'linux') {
    const status = await fs.readFile('/proc/' + pid + '/status', 'utf8');
    return Number(status.match(/^VmHWM:\s+(\d+)/m)?.[1] || 0) * 1024;
  }
  if (process.platform === 'win32') {
    const { stdout } = await exec('powershell.exe', ['-NoProfile', '-Command',
      'Get-Process -Id ' + Number(pid) + ' -ErrorAction Stop | Select-Object -ExpandProperty PeakWorkingSet64'], { windowsHide: true });
    return Number(stdout.trim()) || null;
  }
  return null;
};
