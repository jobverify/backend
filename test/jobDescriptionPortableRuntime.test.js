import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const linuxOnly = { skip: process.platform !== 'linux' };

// These exercise the real activation helper with a shell fixture, never a model.
const fixture = async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite portable runtime-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const runtime = path.join(root, '.cache/description-rewriter-avx2');
  await fs.mkdir(runtime, { recursive: true });
  await fs.mkdir(path.join(root, 'scripts'));
  await fs.mkdir(path.join(root, 'rewriting'));
  const script = path.join(root, 'scripts/portableRewriteRuntime.sh');
  await fs.copyFile(new URL('../scripts/portableRewriteRuntime.sh', import.meta.url), script);
  const model = path.join(root, 'rewriting/model.json');
  await fs.writeFile(model, JSON.stringify({ runtimeTag: 'b11146' }));
  const binary = path.join(runtime, 'llama-server');
  const content = '#!/usr/bin/env bash\nprintf "portable runtime fixture\\n"\n';
  await fs.writeFile(binary, content, { mode: 0o644 });
  const sha = createHash('sha256').update(content).digest('hex');
  await fs.writeFile(path.join(runtime, 'llama-server.sha256'), `${sha} *llama-server\n`);
  const manifest = {
    profile: 'portable-avx2-v1', runtimeTag: 'b11146',
    sourceRevision: '7fe450e19305b828c199d602c23a8337aaa1f03b',
    platform: 'linux', arch: 'x64', buildType: 'RelWithDebInfo', binarySha256: sha,
  };
  const info = path.join(runtime, 'build-info.json');
  await fs.writeFile(info, JSON.stringify(manifest));
  const environment = path.join(root, 'github-env');
  await fs.writeFile(environment, '');
  const activate = () => exec('bash', [script, 'activate'], {
    cwd: root, env: { ...process.env, GITHUB_ENV: environment }, timeout: 15000,
  });
  return { root, runtime, binary, sha, info, manifest, model, environment, activate };
};

test('portable activation restores artifact permissions and exports the verified binary and provenance', linuxOnly, async t => {
  const value = await fixture(t);
  await value.activate();
  const environment = await fs.readFile(value.environment, 'utf8');
  assert.ok(environment.includes(`JOB_DESCRIPTION_REWRITE_BINARY=${value.binary}\n`));
  assert.ok(environment.includes(`JOB_DESCRIPTION_REWRITE_BINARY_SHA256=${value.sha}\n`));
  assert.ok(environment.includes('JOB_DESCRIPTION_REWRITE_RUNTIME_PROFILE=portable-avx2-v1\n'));
  assert.ok(environment.includes(`JOB_DESCRIPTION_REWRITE_RUNTIME_SOURCE_REVISION=${value.manifest.sourceRevision}\n`));
  assert.ok((await fs.stat(value.binary)).mode & 0o100);
});

test('portable activation rejects corrupted artifact bytes before selecting a worker', linuxOnly, async t => {
  const value = await fixture(t);
  await fs.appendFile(value.binary, '\n# changed artifact\n');
  await assert.rejects(value.activate(), error => error.code !== 0 && /FAILED/.test(error.stdout));
  assert.equal(await fs.readFile(value.environment, 'utf8'), '');
});

test('portable activation rejects a different source revision despite a valid binary checksum', linuxOnly, async t => {
  const value = await fixture(t);
  await fs.writeFile(value.info, JSON.stringify({ ...value.manifest, sourceRevision: '0'.repeat(40) }));
  await assert.rejects(value.activate(), error => error.code !== 0 && /sourceRevision mismatch/.test(error.stderr));
  assert.equal(await fs.readFile(value.environment, 'utf8'), '');
});

test('portable activation rejects missing runtime files without selecting a fallback', linuxOnly, async t => {
  const value = await fixture(t);
  await fs.unlink(value.binary);
  await assert.rejects(value.activate());
  assert.equal(await fs.readFile(value.environment, 'utf8'), '');
});

test('portable activation requires a new explicit source pin when the runtime tag changes', linuxOnly, async t => {
  const value = await fixture(t);
  await fs.writeFile(value.model, JSON.stringify({ runtimeTag: 'b99999' }));
  await assert.rejects(value.activate(), error => error.code !== 0 && /Update the portable runtime source pin/.test(error.stderr));
  assert.equal(await fs.readFile(value.environment, 'utf8'), '');
});
