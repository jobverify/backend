import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

test('optional accelerator runtime is selected only after its declared checksum verifies', async t => {
  const { verifyRewriteBinary } = await import('../rewriting/worker.js');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite-gpu-binary-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const binary = path.join(dir, 'llama-server.fixture');
  await fs.writeFile(binary, 'caller supplied runtime');
  const sha = createHash('sha256').update('caller supplied runtime').digest('hex');
  assert.equal(await verifyRewriteBinary(binary, sha), binary);
  await assert.rejects(verifyRewriteBinary(binary, '0'.repeat(64)), /checksum/i);
  await assert.rejects(verifyRewriteBinary(binary), /checksum/i);
});

test('benchmark asset preflight fails locally rather than silently downloading', async t => {
  const { prepareRewriteRuntime } = await import('../rewriting/worker.js');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite-no-download-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await assert.rejects(prepareRewriteRuntime({ directory: dir, allowDownload: false }), error => error.code === 'REWRITE_ASSETS_UNAVAILABLE');
  assert.deepEqual(await fs.readdir(dir), []);
});

test('warm worker receives explicit GPU offload and never unloads itself while idle', async t => {
  const { startRewriteWorker } = await import('../rewriting/worker.js');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite-warm-runtime-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let args;
  const child = Object.assign(new EventEmitter(), { pid: 12345, exitCode: null, signalCode: null,
    kill() { this.exitCode = 0; this.emit('exit', 0, null); } });
  const worker = await startRewriteWorker({ modelFile: 'fixture.gguf', binary: process.execPath, gpuLayers: 'all',
    logFile: path.join(dir, 'worker.log'),
    spawnProcess: (_binary, values) => { args = values; return child; },
    fetchImpl: async () => ({ ok: true, json: async () => ({ data: [{ id: args[args.indexOf('--alias') + 1] }] }) }),
  });
  t.after(() => worker.stop());
  assert.equal(args[args.indexOf('-ngl') + 1], 'all');
  assert.equal(args[args.indexOf('--sleep-idle-seconds') + 1], '-1');
  assert.equal(worker.gpuLayers, 'all');
});

test('GPU offload configuration rejects accidental booleans and malformed layer counts', async () => {
  const { rewriteGpuLayers } = await import('../rewriting/worker.js');
  assert.equal(rewriteGpuLayers(), 0);
  assert.equal(rewriteGpuLayers('all'), 'all');
  assert.equal(rewriteGpuLayers('8'), 8);
  for (const value of [true, false, null, -1, 1.5, 'invalid']) assert.throws(() => rewriteGpuLayers(value), /GPU layers/);
});
