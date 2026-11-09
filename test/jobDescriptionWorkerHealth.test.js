import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { startRewriteWorker } from '../rewriting/worker.js';
import { createRewriteClient, rewriteCandidates, rewriteFailureDetails, probeRewriteClient } from '../rewriting/runner.js';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { expandModelPlan } from '../rewriting/factPlan.js';

const source = 'Role overview: Build Python services for customer applications. Responsibilities: Design reliable APIs and maintain Python services. Required qualifications: At least 2 years of software development experience is required. Preferred qualifications: AWS experience is nice to have.';
const candidate = id => {
  const job = { _id: id, title: 'Software Engineer', company: 'Example', status: 'active', sourceDescription: source,
    descriptionRewrite: { status: 'pending', attempts: 0 } };
  job.sourceContentHash = job.descriptionRewrite.inputHash = buildRewriteInput(job).inputHash;
  return job;
};

test('an immediate spawn failure is reported without an unhandled child error', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite-worker-spawn-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const script = `
    import {startRewriteWorker} from ${JSON.stringify(new URL('../rewriting/worker.js', import.meta.url).href)};
    try { await startRewriteWorker({binary:${JSON.stringify(path.join(directory, 'missing', 'llama-server.exe'))}, modelFile:'fixture.gguf',
      logFile:${JSON.stringify(path.join(directory, 'worker.log'))}, deadline:Date.now()+3000}); process.exitCode=2; }
    catch(error) { console.log(JSON.stringify({name:error.name,failure:error.workerFailure})); }
  `;
  const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', script], { windowsHide: true, timeout: 10000 });
  assert.deepEqual(JSON.parse(stdout), { name: 'RewriteWorkerError', failure: 'spawn_error' });
});

test('worker exit diagnostics and warning logs survive a child process failure', { timeout: 20000 }, async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite-worker-health-'));
  let worker;
  t.after(async () => { await worker?.stop(); await fs.rm(directory, { recursive: true, force: true }); });
  const fixture = path.join(directory, 'server.cjs'), logFile = path.join(directory, 'worker.log');
  await fs.writeFile(fixture, `
    const http = require('node:http');
    const args = process.argv.slice(2), model = args[args.indexOf('--alias') + 1];
    if (!args.includes('--log-disable')) process.stderr.write('worker warning retained\\n');
    http.createServer((request, response) => {
      if (request.url === '/crash') { process.stderr.write('worker exit diagnostic\\n'); process.exit(17); }
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({data:[{id:model}]}));
    }).listen(0, '127.0.0.1', function() { process.send({port:this.address().port}); });
  `);
  // The real child chooses a free port, while the readiness HTTP call is redirected to it.
  let child, port, workerArgs;
  const spawnProcess = (_binary, args, options) => {
    workerArgs = args;
    child = spawn(process.execPath, [fixture, ...args], { ...options, stdio: ['ignore', options.stdio[1], options.stdio[2], 'ipc'] });
    child.on('message', message => { port = message.port; });
    return child;
  };
  const fetchImpl = async (url, options) => {
    while (!port) await delay(5);
    return fetch(url.replace(':18771', ':' + port), options);
  };
  worker = await startRewriteWorker({ binary: process.execPath, modelFile: 'fixture.gguf', port: 18771,
    logFile, spawnProcess, fetchImpl, parallelism: 4, deadline: Date.now() + 5000 });
  assert.ok(workerArgs.includes('--cache-ram'));
  assert.equal(workerArgs[workerArgs.indexOf('--cache-ram') + 1], '128');
  assert.equal(workerArgs[workerArgs.indexOf('--chat-template-kwargs') + 1], '{"enable_thinking":false}');
  assert.equal(workerArgs[workerArgs.indexOf('--reasoning') + 1], 'off');
  assert.equal(workerArgs[workerArgs.indexOf('-np') + 1], '4');
  assert.equal(workerArgs[workerArgs.indexOf('-c') + 1], '32768');
  assert.equal(worker.diagnostics().status, 'running');
  const workerLog = await fs.readFile(logFile, 'utf8');
  assert.match(workerLog, /worker warning retained/);
  const launch = JSON.parse(workerLog.split(/\r?\n/).find(line => line.startsWith('{')));
  assert.equal(launch.event, 'worker_start');
  assert.equal(launch.arguments[launch.arguments.indexOf('-np') + 1], '4');
  assert.equal(launch.arguments[launch.arguments.indexOf('-c') + 1], '32768');
  assert.equal(launch.debugger, 'none');
  assert.equal(launch.environment, undefined);
  await fetch('http://127.0.0.1:' + port + '/crash').catch(() => {});
  for (let i = 0; i < 100 && child.exitCode === null; i++) await delay(5);
  assert.throws(() => worker.assertAlive(), error => error.name === 'RewriteWorkerError' && error.workerExitCode === 17);
  assert.equal(worker.diagnostics().status, 'exited');
  assert.equal(worker.diagnostics().exitCode, 17);
  assert.match(await fs.readFile(logFile, 'utf8'), /worker exit diagnostic/);
});

test('GPU worker launch retains 32 requested slots on a two-CPU host', { timeout: 20000 }, async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite-gpu-slots-'));
  let worker, port;
  t.mock.method(os, 'availableParallelism', () => 2);
  t.after(async () => { await worker?.stop(); await fs.rm(directory, { recursive: true, force: true }); });
  const fixture = path.join(directory, 'server.cjs');
  await fs.writeFile(fixture, `
    const assert = require('node:assert/strict');
    const args = process.argv.slice(2), value = flag => args[args.indexOf(flag) + 1];
    for (const [flag, expected] of [['-np','32'], ['-c','262144'], ['-t','2'], ['-tb','2'], ['-ngl','all']]) assert.equal(value(flag), expected);
    require('node:http').createServer((_request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({data:[{id:value('--alias')}]}));
    }).listen(0, '127.0.0.1', function() { process.send({port:this.address().port}); });
  `);
  worker = await startRewriteWorker({ binary: process.execPath, modelFile: 'fixture.gguf', port: 18772,
    logFile: path.join(directory, 'worker.log'), threads: 8, parallelism: 32, gpuLayers: 'all',
    deadline: Date.now() + 5000,
    spawnProcess: (_binary, args, options) => {
      const child = spawn(process.execPath, [fixture, ...args], { ...options, stdio: ['ignore', options.stdio[1], options.stdio[2], 'ipc'] });
      child.on('message', message => { port = message.port; });
      return child;
    },
    fetchImpl: async (url, options) => {
      for (let attempts = 0; !port && attempts < 200; attempts++) await delay(5);
      if (!port) throw new Error('Fixture failed to start');
      return fetch(url.replace(':18772', ':' + port), options);
    },
  });
  assert.equal(worker.parallelism, 32);
  assert.equal(worker.gpuLayers, 'all');
  assert.equal(worker.diagnostics().status, 'running');
});

test('worker death halts scheduling and leaves in-flight queue entries pending', async () => {
  let started = 0, writes = 0, active = 0;
  const dead = Object.assign(new Error('CPU generator exited'), { name: 'RewriteWorkerError', workerExitCode: 17 });
  const rows = Array.from({ length: 12 }, (_, i) => candidate(String(i)));
  await assert.rejects(rewriteCandidates(rows, { concurrency: 4, deadline: Date.now() + 10000,
    client: { generate: async () => { started++; active++; await delay(10); active--; throw dead; } },
    update: async () => { writes++; return { matchedCount: 1 }; },
  }), error => error === dead);
  assert.equal(started, 4); assert.equal(active, 0); assert.equal(writes, 0);
});

test('local connection refusal is a worker failure rather than a per-description failure', async () => {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  await assert.rejects(createRewriteClient({ endpoint: 'http://127.0.0.1:' + port }).generate(buildRewriteInput(candidate('closed'))),
    error => error.name === 'RewriteWorkerError' && error.workerFailure === 'connection_refused');
});

test('fresh generation probe exercises all slots without using cached plans or writing jobs', async t => {
  let active = 0, peak = 0, requests = 0;
  const server = http.createServer(async (request, response) => {
    for await (const chunk of request) { /* Consume the real production client request. */ }
    requests++; active++; peak = Math.max(peak, active); await delay(10); active--;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ categories: [], overviewFactId: 0 }) }, finish_reason: 'stop' }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const result = await probeRewriteClient(createRewriteClient({ endpoint: 'http://127.0.0.1:' + server.address().port, format: 'fact-plan' }),
    { concurrency: 4, deadline: Date.now() + 10000 });
  assert.equal(requests, 4); assert.equal(peak, 4); assert.equal(active, 0); assert.equal(result.requests, 4);
});

test('fresh generation probe supports 32 concurrent slots', async () => {
  let active = 0, peak = 0, requests = 0;
  const result = await probeRewriteClient({ generate: async input => {
    requests++; active++; peak = Math.max(peak, active); await delay(20); active--;
    return { value: expandModelPlan({ categories: [], overviewFactId: 0 }, input), format: 'fact-plan', finishReason: 'stop' };
  } }, { concurrency: 32, deadline: Date.now() + 10000 });
  assert.equal(requests, 32);
  assert.equal(peak, 32);
  assert.equal(active, 0);
  assert.equal(result.requests, 32);
});

test('a failed probe drains the other slots and fails before production processing', async () => {
  let active = 0;
  await assert.rejects(probeRewriteClient({ generate: async () => {
    active++; await delay(10); active--; throw new Error('invalid generator output with private prompt');
  } }, { concurrency: 4, deadline: Date.now() + 10000 }), error => error.name === 'RewriteWorkerError'
    && error.workerFailure === 'generation_probe' && !error.message.includes('private prompt'));
  assert.equal(active, 0);
});

test('fatal worker diagnostics expose exit state without source text or credentials', () => {
  const failure = Object.assign(new Error('private source and token'), { name: 'RewriteWorkerError', workerExitCode: 17,
    workerSignal: 'SIGABRT', workerFailure: 'process_exit' });
  assert.deepEqual(rewriteFailureDetails(failure, 'process_queue'), { errorType: 'RewriteWorkerError', errorPhase: 'process_queue',
    workerExitCode: 17, workerSignal: 'SIGABRT', workerFailure: 'process_exit' });
});
