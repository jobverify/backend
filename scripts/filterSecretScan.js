import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

// Deliberately no automatic baseline creation. Each exception needs a human
// review of the value and its use, followed by a rule + file + value digest.
const [rawPath, policyPath, outputPath, sourceRoot, exitText] = process.argv.slice(2);

function relativeFile(input, root = '-') {
  if (typeof input !== 'string' || !input || /[\x00-\x1f]/.test(input)) {
    throw new Error('Invalid finding path');
  }
  let file = input.replaceAll('\\', '/');
  if (root !== '-') {
    const prefix = root.replaceAll('\\', '/').replace(/\/$/, '') + '/';
    if (!file.startsWith(prefix)) throw new Error('Finding outside scanned tree');
    file = file.slice(prefix.length);
  }
  if (file.startsWith('/') || file.includes(':') ||
      file.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid repository-relative path');
  }
  return file;
}

function processReport() {
  if (!rawPath || !policyPath || !outputPath || !sourceRoot ||
      path.resolve(rawPath) === path.resolve(outputPath) || !/^[01]$/.test(exitText)) {
    throw new Error('Invalid scan invocation or scanner failure');
  }
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  if (policy?.version !== 1 || !Array.isArray(policy.exceptions)) {
    throw new Error('Invalid exception policy');
  }
  const reviewed = new Set();
  for (const entry of policy.exceptions) {
    if (!entry || typeof entry.rule !== 'string' || !/^[a-z0-9-]+$/.test(entry.rule) ||
        typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) ||
        typeof entry.reason !== 'string' || !entry.reason.trim() ||
        !Array.isArray(entry.files) || !entry.files.length ||
        entry.files.some(file => relativeFile(file) !== file || /[*?]/.test(file))) {
      throw new Error('Invalid reviewed exception');
    }
    for (const file of entry.files) {
      reviewed.add(JSON.stringify([entry.rule, file, entry.sha256]));
    }
  }
  const report = JSON.parse(readFileSync(rawPath, 'utf8'));
  if (!Array.isArray(report) || (report.length > 0) !== (exitText === '1')) {
    throw new Error('Invalid report or inconsistent scanner result');
  }
  let accepted = 0;
  const findings = [];
  for (const entry of report) {
    if (!entry || typeof entry.RuleID !== 'string' || !/^[a-z0-9-]+$/.test(entry.RuleID) ||
        typeof entry.Secret !== 'string' || !entry.Secret || entry.Secret === 'REDACTED' ||
        !Number.isSafeInteger(entry.StartLine) || entry.StartLine < 1 ||
        !Number.isSafeInteger(entry.EndLine) || entry.EndLine < entry.StartLine ||
        typeof entry.Commit !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})?$/.test(entry.Commit)) {
      throw new Error('Invalid finding metadata');
    }
    const file = relativeFile(entry.File, sourceRoot);
    const digest = createHash('sha256').update(entry.Secret, 'utf8').digest('hex');
    if (reviewed.has(JSON.stringify([entry.RuleID, file, digest]))) {
      accepted++;
      continue;
    }
    // Never forward Match, Secret, messages, authors, or free-form fingerprints.
    findings.push({ RuleID: entry.RuleID, File: file,
      StartLine: entry.StartLine, EndLine: entry.EndLine, Commit: entry.Commit });
  }
  writeFileSync(outputPath, JSON.stringify(findings, null, 2) + '\n', { mode: 0o600 });
  console.log(`Secret scan: ${accepted} reviewed matches; ${findings.length} unresolved findings.`);
  return findings.length ? 1 : 0;
}

try {
  process.exitCode = processReport();
} catch {
  // JSON parser diagnostics can contain source excerpts. Keep errors generic.
  console.error('Secret scan failed: invalid input, report, policy, or scanner status.');
  process.exitCode = 2;
} finally {
  if (rawPath && rawPath !== policyPath && rawPath !== outputPath) {
    try { rmSync(rawPath, { force: true }); } catch {
      console.error('Secret scan failed: unable to remove raw report.');
      process.exitCode = 2;
    }
  }
}
