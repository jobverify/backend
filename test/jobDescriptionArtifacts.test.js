import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { ensureArtifact } from '../rewriting/worker.js';

test('artifact checksum mismatch never replaces a model file or leaves partial downloads', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite-artifact-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'model.gguf'); await fs.writeFile(file, 'previous');
  const server = http.createServer((req, res) => res.end('corrupt download'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  await assert.rejects(ensureArtifact({ file, url: 'http://127.0.0.1:' + server.address().port, sha256: 'a'.repeat(64) }), /checksum/);
  assert.equal(await fs.readFile(file, 'utf8'), 'previous');
  assert.deepEqual(await fs.readdir(dir), ['model.gguf']);
});
