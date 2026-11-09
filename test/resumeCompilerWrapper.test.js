import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

test('compiler copies the trusted 24 MB format before limiting untrusted output', { skip: process.platform === 'win32' }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-wrapper-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directories = ['source', 'temporary', 'work', 'bin'];
  await Promise.all(directories.map(name => fs.mkdir(path.join(root, name))));
  const format = await fs.open(path.join(root, 'source/latex.fmt'), 'w');
  await format.truncate(24 * 1024 * 1024); await format.close();
  // Redirect only filesystem locations; execute the real production wrapper.
  const wrapper = (await fs.readFile(new URL('../resume-tailoring/compiler/compile.sh', import.meta.url), 'utf8'))
    .replaceAll('/opt/tectonic-cache', path.join(root, 'source'))
    .replaceAll('/tmp/tectonic-cache', path.join(root, 'temporary/cache'))
    .replaceAll('/tmp/compiler.log', path.join(root, 'temporary/compiler.log'))
    .replaceAll('/work', path.join(root, 'work'));
  const script = path.join(root, 'compile.sh'); await fs.writeFile(script, wrapper);
  const compiler = path.join(root, 'bin/tectonic');
  await fs.writeFile(compiler, '#!/bin/sh\nprintf "%s" "%PDF-synthetic" > "$FIXTURE_OUT/resume.pdf"\n', { mode: 0o755 });
  const run = () => spawnSync('/bin/sh', [script, '--untrusted', '--only-cached'], {
    input: 'Synthetic document input', encoding: 'utf8', timeout: 15000,
    env: { ...process.env, PATH: `${path.join(root, 'bin')}:${process.env.PATH}`, FIXTURE_OUT: path.join(root, 'work') },
  });
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '%PDF-synthetic');
  assert.equal((await fs.stat(path.join(root, 'temporary/cache/latex.fmt'))).size, 24 * 1024 * 1024);
  // Moving the limit must not remove it for generated files.
  await fs.rm(path.join(root, 'temporary/cache'), { recursive: true });
  await fs.writeFile(compiler, '#!/bin/sh\nexec dd if=/dev/zero of="$FIXTURE_OUT/resume.pdf" bs=1048576 count=32\n', { mode: 0o755 });
  const oversized = run();
  assert.notEqual(oversized.status, 0);
  assert.equal(oversized.stdout, '');
  assert.ok((await fs.stat(path.join(root, 'work/resume.pdf'))).size < 32 * 1024 * 1024);
});
