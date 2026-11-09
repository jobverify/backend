import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/filterSecretScan.js', import.meta.url));
const value = ['public', 'board', 'identifier'].join('-');
const digest = createHash('sha256').update(value).digest('hex');
const finding = (changes = {}) => ({
  RuleID: 'generic-api-key', File: 'scraper/example/fixtures/page.html',
  Secret: value, Match: `token=${value}`, StartLine: 12, EndLine: 12,
  Commit: '', Fingerprint: 'private context must not escape',
  Message: 'private commit message', Author: 'private author', ...changes,
});
const exception = {
  rule: 'generic-api-key', files: ['scraper/example/fixtures/page.html'],
  sha256: digest, reason: 'Reviewed public job-board identifier.',
};

function run(t, { findings = [finding()], policy = [exception], scanExit = 1,
  root = '-', rawText } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'secret-filter-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const raw = path.join(dir, 'raw.json');
  const output = path.join(dir, 'safe.json');
  const policyPath = path.join(dir, 'policy.json');
  writeFileSync(raw, rawText ?? JSON.stringify(findings));
  writeFileSync(policyPath, JSON.stringify({ version: 1, exceptions: policy }));
  const result = spawnSync(process.execPath,
    [script, raw, policyPath, output, root, String(scanExit)], { encoding: 'utf8' });
  return { ...result, rawExists: existsSync(raw),
    report: existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : null };
}

test('reviewed value passes in both history and exported-tree reports', t => {
  for (const [root, file] of [['-', exception.files[0]],
    ['/runner/current', `/runner/current/${exception.files[0]}`],
    ['C:\\runner\\current', `C:\\runner\\current\\${exception.files[0].replaceAll('/', '\\')}`]]) {
    const result = run(t, { root, findings: [finding({ File: file, StartLine: 99, EndLine: 99 })] });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.report, []);
    assert.equal(result.rawExists, false);
  }
});

test('replacement, new finding in same fixture, moved value and changed rule still fail', t => {
  for (const changes of [
    { Secret: `${value}-replacement` },
    { File: 'scraper/other/fixtures/page.html' },
    { RuleID: 'jwt' },
  ]) {
    const result = run(t, { findings: [finding(), finding(changes)] });
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.report.length, 1);
    assert.equal(result.rawExists, false);
    const serialized = JSON.stringify(result.report) + result.stdout + result.stderr;
    for (const sensitive of [value, 'private context', 'private commit', 'private author']) {
      assert.equal(serialized.includes(sensitive), false);
    }
    assert.deepEqual(Object.keys(result.report[0]).sort(),
      ['Commit', 'EndLine', 'File', 'RuleID', 'StartLine'].sort());
  }
});

test('malformed input and scanner errors fail closed and remove raw values', t => {
  for (const options of [
    { rawText: '{broken' }, { findings: {} },
    { findings: [finding({ Secret: 'REDACTED' })] },
    { findings: [finding({ Secret: undefined })] },
    { findings: [finding({ StartLine: '12' })] },
    { findings: [], scanExit: 2 }, { findings: [], scanExit: 1 },
    { scanExit: 0 }, { scanExit: 127 },
    { policy: [{ ...exception, sha256: '*' }] },
    { policy: [{ ...exception, reason: '' }] },
    { policy: [{ ...exception, files: ['../page.html'] }] },
    { policy: [{ ...exception, files: ['/absolute/page.html'] }] },
    { policy: [{ ...exception, files: [] }] },
    { policy: [{ ...exception, files: [exception.files[0], '*'] }] },
    { policy: [{ ...exception, rule: '*' }] },
  ]) {
    const result = run(t, options);
    assert.equal(result.status, 2, JSON.stringify(options) + result.stderr);
    assert.equal(result.rawExists, false);
    assert.equal((result.stdout + result.stderr).includes(value), false);
  }
});

test('path traversal and absolute history paths cannot inherit an exception', t => {
  for (const [root, file] of [
    ['-', `/outside/${exception.files[0]}`],
    ['-', `elsewhere/../${exception.files[0]}`],
    ['/runner/current', `/outside/${exception.files[0]}`],
    ['/runner/current', `/runner/current/../current/${exception.files[0]}`],
  ]) {
    const result = run(t, { root, findings: [finding({ File: file })] });
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.rawExists, false);
  }
});

test('empty successful scan passes', t => {
  const result = run(t, { findings: [], scanExit: 0 });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.report, []);
});
