import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readPublishingGapSnapshot } from './collectPublishingGapSnapshot.js';
import { buildPublicationVisibilityAudit, publicationAuditSources } from './publicationVisibilityDiagnostics.js';

const usage = 'node scripts/auditPublicationVisibility.js --report=<coverage-report.json> (--snapshot=<runtime-snapshot.json> | --read-database) --output=<audit.json>';
const csv = audit => {
  const fields = ['source', 'archivedSavedJobs', 'observedSavedJobs', 'observedVisibleJobs', 'diagnosis', 'unknownReason', 'primaryReason', 'excludedJobs', 'reasonCounts', 'action'];
  const escape = value => {
    const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [fields.join(','), ...audit.rows.map(row => [row.source, row.archived.savedJobs, row.observed.savedJobs,
    row.observed.visibleJobs, row.diagnosis, row.unknownReason, row.primaryReason, row.excludedJobs, row.reasonCounts, row.action]
    .map(escape).join(','))].join('\n') + '\n';
};

export async function runPublicationVisibilityAudit({ reportPath, snapshotPath, readDatabase = false, outputPath,
  now = new Date(), reader = readPublishingGapSnapshot }) {
  if (!reportPath || !outputPath || (readDatabase ? Boolean(snapshotPath) : !snapshotPath)) throw new TypeError(usage);
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  const sources = publicationAuditSources(report);
  const snapshot = readDatabase ? await reader({ now, diagnosticSources: sources })
    : JSON.parse(await readFile(snapshotPath, 'utf8'));
  const audit = buildPublicationVisibilityAudit({ report, snapshot, now });
  const output = path.resolve(outputPath);
  const stem = output.replace(/\.json$/i, '');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(audit, null, 2)}\n`);
  await writeFile(`${stem}.csv`, csv(audit));
  if (readDatabase) {
    // Preserve only source-scoped inventory and diagnostics. Never persist the
    // connection URI, driver error messages, or unrelated scraper status text.
    const selected = new Set(sources);
    await writeFile(`${stem}.snapshot.json`, `${JSON.stringify({
      generatedAt: snapshot.generatedAt, databaseAvailable: snapshot.databaseAvailable,
      ...(snapshot.errorKind ? { errorKind: snapshot.errorKind } : {}),
      siteSettings: snapshot.siteSettings,
      inventory: snapshot.inventory?.filter(row => selected.has(row.source)) ?? null,
      publicationDiagnostics: snapshot.publicationDiagnostics ?? null,
    }, null, 2)}\n`);
  }
  return audit;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') console.log(usage);
    else {
      if (args.some(arg => !/^--(?:report|snapshot|output)=.+$/.test(arg) && arg !== '--read-database')) throw new TypeError(usage);
      const value = key => args.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
      const audit = await runPublicationVisibilityAudit({ reportPath: value('report'), snapshotPath: value('snapshot'),
        outputPath: value('output'), readDatabase: args.includes('--read-database') });
      console.log(JSON.stringify({ databaseAvailable: audit.databaseAvailable, ...audit.summary }));
    }
  } catch (error) {
    // Do not serialize errors from database access or input data to stdout.
    console.error(error instanceof TypeError && error.message === usage ? usage : 'Publication visibility audit failed; check the input files and arguments.');
    process.exitCode = 1;
  }
}
