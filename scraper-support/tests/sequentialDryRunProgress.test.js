import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

test('the sequential dry runner writes a snapshot and defers classification', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sequential-dry-progress-'));
  const original = new URL('../runner.js', import.meta.url);
  const fixturePath = path.join(directory, 'providers.mjs');
  const runnerPath = path.join(directory, 'runner.mjs');
  const outputPath = path.join(directory, 'jobs.json');
  // Replace only the external provider inventory in an isolated copy. Execute the
  // real sequential runner/persistence code without scraping or touching real snapshots.
  fs.writeFileSync(fixturePath, `export const buildScrapers = () => [{ name: 'sequential-fixture', provider: { adapter: 'script', dryRunEnrichPublicExperience: false }, dryRunFile: ${JSON.stringify(outputPath)}, run: async () => [{ title: 'Engineer', company: 'Example', country: 'India', location: 'Bengaluru, India', description: 'Build software.', link: 'https://example.com/jobs/one' }] }];`);
  const source = fs.readFileSync(original, 'utf8').replace(/\bfrom\s+(['"])([^'"]+)\1/g, (match, quote, specifier) => {
    const target = specifier === './providers/index.js' ? pathToFileURL(fixturePath).href
      : specifier.startsWith('.') ? new URL(specifier, original).href : import.meta.resolve(specifier);
    return `from ${JSON.stringify(target)}`;
  });
  fs.writeFileSync(runnerPath, source);
  try {
    const result = spawnSync(process.execPath, [runnerPath, '--dry-run'], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8', timeout: 15000,
      env: { ...process.env, SCRAPER_ONLY: 'sequential-fixture', SCRAPER_START_AT: '', SCRAPER_START_AFTER: '', SCRAPER_CHECKPOINT_FILE: path.join(directory, 'run-state.json') },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(outputPath), true, result.stderr || result.stdout);
    assert.equal(JSON.parse(fs.readFileSync(outputPath)).length, 1);
    assert.match(result.stdout, /\[sequential-fixture\] classification deferred/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'run-state.json'))).status, 'complete');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
