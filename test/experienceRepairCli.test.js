import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('experience preview disables automatic collection and index creation before connecting', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'jobverify-experience-preview-'));
  try {
    const observed = path.join(root, 'observed.json');
    const preload = path.join(root, 'observe.mjs');
    const mongooseUrl = import.meta.resolve('mongoose');
    writeFileSync(preload, `import mongoose from ${JSON.stringify(mongooseUrl)};\nimport {writeFileSync} from 'node:fs';\nmongoose.connect=async()=>{writeFileSync(process.env.EXPERIENCE_PREVIEW_OBSERVATION,JSON.stringify({autoIndex:mongoose.get('autoIndex'),autoCreate:mongoose.get('autoCreate')}));throw new Error('Fixture stopped before any database connection');};\n`);
    const script = fileURLToPath(new URL('../scripts/repairMainExperienceRequirements.js', import.meta.url));
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, script, '--source=arcadis'], {
      windowsHide: true, encoding: 'utf8', timeout: 20000,
      env: { ...process.env, MONGO_URI: 'mongodb://127.0.0.1:27017/unused_preview_fixture', EXPERIENCE_PREVIEW_OBSERVATION: observed },
    });
    assert.equal(result.status, 1, result.stderr);
    assert.deepEqual(JSON.parse(readFileSync(observed, 'utf8')), { autoIndex: false, autoCreate: false });
  } finally {
    assert.equal(path.dirname(root), tmpdir());
    rmSync(root, { recursive: true, force: true });
  }
});
