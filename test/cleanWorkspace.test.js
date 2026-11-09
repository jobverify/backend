import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('cleanup retains GLiClass runtime, weights and worker state while deleting scrape artifacts', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gliclass-clean-test-'));
  const preserved = ['.cache/gliclass-hub/hub/config.json', '.cache/gliclass-model/weights.bin', '.cache/gliclass-runtime/python', '.cache/scraper-actions/classification-0.json', '.cache/description-rewriter/model.bin'];
  const removed = ['.cache/classification-runs/old.json', 'scraper/example/jobs.json', 'coverage/old.json'];
  try {
    fs.mkdirSync(path.join(directory, 'scripts'));
    fs.copyFileSync(new URL('../scripts/cleanWorkspace.js', import.meta.url), path.join(directory, 'scripts/cleanWorkspace.js'));
    fs.writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}');
    for (const name of [...preserved, ...removed]) {
      const target = path.join(directory, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, 'fixture');
    }
    const result = spawnSync(process.execPath, ['scripts/cleanWorkspace.js'], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    for (const name of preserved) assert.equal(fs.existsSync(path.join(directory, name)), true, `${name} must survive`);
    for (const name of removed) assert.equal(fs.existsSync(path.join(directory, name)), false, `${name} must be cleaned`);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
