import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const unavailable = reason => ({ status: 'unavailable', reason, vulnerabilityCounts: null, findings: null });

// npm uses a nonzero exit for both findings and failed registry requests. Require
// a complete advisory response before interpreting either exit as an audit.
export function interpretDependencyAudit({ stdout, status, error } = {}) {
  if (error) return unavailable(error.code === 'ETIMEDOUT' ? 'audit_timeout' : 'audit_process_failed');
  let report;
  try { report = JSON.parse(String(stdout || '')); } catch { return unavailable('invalid_audit_response'); }
  const counts = report?.metadata?.vulnerabilities;
  if (!report || report.error || report.auditReportVersion !== 2 || !counts
    || !severities.every(level => Number.isInteger(counts[level]) && counts[level] >= 0)
    || !Number.isInteger(counts.total) || counts.total !== severities.reduce((sum, level) => sum + counts[level], 0)
    || !report.vulnerabilities || typeof report.vulnerabilities !== 'object' || Array.isArray(report.vulnerabilities)
    || ![0, 1].includes(status)) return unavailable('advisory_registry_unavailable');
  const entries = Object.entries(report.vulnerabilities);
  if (entries.length !== counts.total || entries.some(([, value]) => !value || !severities.includes(value.severity)
      || !Array.isArray(value.via) || value.via.some(via => typeof via !== 'string' && (!via || typeof via !== 'object' || Array.isArray(via))))
    || severities.some(level => entries.filter(([, value]) => value.severity === level).length !== counts[level])) {
    return unavailable('incomplete_audit_response');
  }
  if (counts.total === 0 && status !== 0) return unavailable('audit_process_failed');
  return {
    status: counts.total ? 'vulnerable' : 'clean', reason: null, vulnerabilityCounts: counts,
    findings: entries.map(([name, value]) => ({ name, severity: value.severity, direct: value.isDirect === true,
      range: value.range ?? null, nodes: value.nodes ?? [], fixAvailable: value.fixAvailable ?? false,
      advisories: (value.via || []).map(via => typeof via === 'string' ? { dependency: via }
        : { title: via.title, url: via.url, severity: via.severity, range: via.range }),
    })),
  };
}

export function dependencyAuditExitCode(result) {
  if (result.status === 'unavailable') return 2;
  return ['moderate', 'high', 'critical'].some(level => result.vulnerabilityCounts?.[level] > 0) ? 1 : 0;
}

export function runDependencyAudit({ npmCli = process.env.npm_execpath } = {}) {
  const candidates = [npmCli,
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
  const cli = candidates.find(candidate => candidate && fs.existsSync(candidate));
  if (!cli) return unavailable('npm_cli_unavailable');
  const execution = spawnSync(process.execPath, [cli, 'audit', '--package-lock-only', '--include=dev', '--json',
    '--audit-level=moderate', '--fetch-retries=0', '--fetch-timeout=15000', '--cache=.cache/npm-audit'], {
    encoding: 'utf8', windowsHide: true, timeout: 45000, maxBuffer: 8 * 1024 * 1024,
  });
  return interpretDependencyAudit(execution);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const index = args.indexOf('--output');
  const output = path.resolve(index >= 0 && args[index + 1] ? args[index + 1] : '.cache/dependency-audit.json');
  const audit = runDependencyAudit();
  const result = { generatedAt: new Date().toISOString(), scope: 'complete-lockfile-including-development',
    threshold: 'moderate', ...audit };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ ...result, findings: result.findings?.map(({ name, severity, fixAvailable }) => ({ name, severity, fixAvailable })) ?? null, output }));
  process.exitCode = dependencyAuditExitCode(result);
}
