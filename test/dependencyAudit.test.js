import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { interpretDependencyAudit, dependencyAuditExitCode, runDependencyAudit } from '../scripts/auditDependencies.js';

const response = (severity = null) => ({
  auditReportVersion: 2,
  vulnerabilities: severity ? { dependency: { name: 'dependency', severity, isDirect: false,
    range: '<2.0.1', nodes: ['node_modules/dependency'], fixAvailable: true,
    via: [{ title: 'Example advisory', url: 'https://github.com/advisories/example', severity, range: '<2.0.1' }] } } : {},
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0,
    ...(severity ? { [severity]: 1 } : {}), total: severity ? 1 : 0 } },
});

test('a confirmed clean audit passes, while current moderate/high/critical findings fail the gate', () => {
  const clean = interpretDependencyAudit({ stdout: JSON.stringify(response()), status: 0 });
  assert.equal(clean.status, 'clean');
  assert.equal(dependencyAuditExitCode(clean), 0);
  for (const severity of ['moderate', 'high', 'critical']) {
    const result = interpretDependencyAudit({ stdout: JSON.stringify(response(severity)), status: 1 });
    assert.equal(result.status, 'vulnerable');
    assert.equal(result.findings[0].severity, severity);
    assert.equal(dependencyAuditExitCode(result), 1);
  }
});

test('low findings remain visible in the report without failing the moderate threshold', () => {
  const result = interpretDependencyAudit({ stdout: JSON.stringify(response('low')), status: 0 });
  assert.equal(result.findings.length, 1);
  assert.equal(dependencyAuditExitCode(result), 0);
});

test('registry failures and malformed or truncated reports cannot pass as zero vulnerabilities', () => {
  for (const execution of [
    { stdout: '{"error":{"code":"ETIMEDOUT"}}', status: 1 },
    { stdout: '', status: 1 }, { stdout: '{broken', status: 0 },
    { stdout: JSON.stringify({ metadata: { vulnerabilities: { total: 0 } } }), status: 0 },
    { stdout: JSON.stringify(response()), status: null },
    { stdout: JSON.stringify(response()), status: 1 },
    { stdout: JSON.stringify(response()), status: 0, error: { code: 'ETIMEDOUT' } },
  ]) {
    const result = interpretDependencyAudit(execution);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.vulnerabilityCounts, null);
    assert.equal(dependencyAuditExitCode(result), 2);
  }
});

test('mismatched totals and incomplete advisory findings invalidate an audit', () => {
  for (const change of [
    value => { value.vulnerabilities = {}; },
    value => { value.metadata.vulnerabilities.total = 0; },
    value => { value.vulnerabilities.dependency.severity = 'low'; },
  ]) {
    const value = response('critical');
    change(value);
    assert.equal(interpretDependencyAudit({ stdout: JSON.stringify(value), status: 1 }).status, 'unavailable');
  }
});

test('unexpected JSON shapes and malformed advisory arrays remain unavailable without crashing', () => {
  const malformed = [null, [], 'unexpected', { ...response('high'), vulnerabilities: { dependency: { ...response('high').vulnerabilities.dependency, via: {} } } },
    { ...response('high'), vulnerabilities: { dependency: { ...response('high').vulnerabilities.dependency, via: [null] } } }];
  for (const value of malformed) {
    const result = interpretDependencyAudit({ stdout: JSON.stringify(value), status: 1 });
    assert.equal(result.status, 'unavailable');
    assert.equal(result.vulnerabilityCounts, null);
    assert.equal(dependencyAuditExitCode(result), 2);
  }
});

test('lockfile audit explicitly includes development findings even in production', () => {
  const tempRoot = path.resolve(tmpdir());
  const directory = mkdtempSync(path.join(tempRoot, 'backend-security-audit-'));
  const npmCli = path.join(directory, 'npm-fixture.cjs');
  try {
    writeFileSync(npmCli, `const args=process.argv.slice(2); if(!args.includes('--include=dev') || !args.includes('--package-lock-only')) process.exit(3); console.log(${JSON.stringify(JSON.stringify(response('moderate')))}); process.exitCode=1;`);
    const result = runDependencyAudit({ npmCli });
    assert.equal(result.status, 'vulnerable');
    assert.equal(dependencyAuditExitCode(result), 1);
  } finally {
    const relative = path.relative(tempRoot, path.resolve(directory));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsafe audit fixture cleanup');
    rmSync(directory, { recursive: true, force: true });
  }
});
