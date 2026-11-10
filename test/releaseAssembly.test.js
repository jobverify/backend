import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assembleRelease, inspectRelease } from '../scripts/assembleRelease.js';

test('assembled releases exclude private configuration and reject embedded credentials with redacted diagnostics', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-release-test-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'source');
  await fs.mkdir(path.join(source, 'src'), { recursive: true });
  const dummy = 'github_pat_' + 'DummyToken'.repeat(8);
  await fs.writeFile(path.join(source, 'backend.env'), `GITHUB_PAT=${dummy}`);
  await fs.writeFile(path.join(source, '.env'), `GITHUB_PAT=${dummy}`);
  await fs.writeFile(path.join(source, '.env.example'), 'JWT_SECRET=\nGOOGLE_CLIENT_ID=public.apps.googleusercontent.com\n');
  await fs.writeFile(path.join(source, 'src', 'app.js'), 'export const ready = true;');
  await fs.mkdir(path.join(source, 'classification', 'gliclass'), { recursive: true });
  await fs.mkdir(path.join(source, 'rewriting'));
  await fs.writeFile(path.join(source, 'classification', 'policy.json'), '{"version":1}');
  await fs.writeFile(path.join(source, 'classification', 'gliclass', 'runtime.py'), 'def ready(): return True');
  await fs.writeFile(path.join(source, 'rewriting', 'model.json'), '{}');
  const original = await inspectRelease(source);
  assert.ok(original.some(finding => finding.path === 'backend.env'));
  assert.ok(!JSON.stringify(original).includes(dummy));
  const projects = [{ source, kind: 'backend', name: 'backend' }];
  await assert.rejects(assembleRelease({ destination: path.join(source, 'nested-release'), projects }), /outside.*source/i);
  if (process.platform === 'win32') {
    await assert.rejects(assembleRelease({ destination: path.join(temp, 'SOURCE', 'case-nested'), projects }), /outside.*source/i);
  }
  const output = path.join(temp, 'safe');
  await assembleRelease({ destination: output, projects });
  assert.deepEqual(await inspectRelease(output), []);
  assert.equal(await fs.readFile(path.join(output, 'backend', 'src', 'app.js'), 'utf8'), 'export const ready = true;');
  assert.equal(await fs.readFile(path.join(output, 'backend', 'classification', 'policy.json'), 'utf8'), '{"version":1}');
  assert.equal(await fs.readFile(path.join(output, 'backend', 'classification', 'gliclass', 'runtime.py'), 'utf8'), 'def ready(): return True');
  assert.equal(await fs.readFile(path.join(output, 'backend', 'rewriting', 'model.json'), 'utf8'), '{}');
  await assert.rejects(fs.access(path.join(output, 'backend', '.env')));
  await assert.rejects(assembleRelease({ destination: output, projects }), /EEXIST/);
  await fs.writeFile(path.join(source, 'src', 'app.js'), `export const credential = '${dummy}';`);
  await assert.rejects(assembleRelease({ destination: path.join(temp, 'unsafe'), projects }), error => {
    assert.match(error.message, /github_token/); assert.ok(!error.message.includes(dummy)); return true;
  });
  await fs.writeFile(path.join(source, '.env.example'), `JWT_SECRET=${dummy}`);
  assert.ok((await inspectRelease(source)).some(finding => finding.rule === 'populated_secret_template'));
});

test('frontend source releases preserve public manifests and extension sources', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-frontend-release-test-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'source');
  await fs.mkdir(path.join(source, 'public'), { recursive: true });
  await fs.mkdir(path.join(source, 'extensions'));
  await fs.writeFile(path.join(source, 'public', 'site.webmanifest'), '{}');
  await fs.writeFile(path.join(source, 'public', 'sitemap.xml'), '<urlset/>');
  await fs.writeFile(path.join(source, 'extensions', 'manifest.json'), '{"manifest_version":3}');
  const destination = path.join(temp, 'release');
  await assembleRelease({ destination, projects: [{ source, kind: 'frontend', name: 'frontend' }] });
  for (const relative of ['public/site.webmanifest', 'public/sitemap.xml', 'extensions/manifest.json']) {
    assert.equal(await fs.readFile(path.join(destination, 'frontend', relative), 'utf8'), await fs.readFile(path.join(source, relative), 'utf8'));
  }
});
